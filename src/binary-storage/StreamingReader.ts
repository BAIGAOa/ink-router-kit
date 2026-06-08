import * as fs from 'node:fs';
import { TypeTag } from './types.js';
import type { StreamingReaderOptions, StreamingReaderAPI } from './types.js';

const TAG_SIZE  = 1;
const NUM_SIZE  = 8;
const BOOL_SIZE = 1;
const LEN_SIZE  = 4;

/**
 * Externally-resolvable Promise.
 *
 * A regular `new Promise(resolve => ...)` only gives you the resolve
 * callback inside the constructor. Deferred stores both callbacks as
 * properties so they can be called from stream event handlers or
 * lifecycle methods (onData, onEnd, destroy, fail) that fire
 * asynchronously and independently of the consumer's await point.
 */
class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T) => void;
  reject!: (reason: unknown) => void;
  constructor() {
    this.promise = new Promise<T>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
}

interface BatchWaiter {
  deferred: Deferred<unknown[]>;
  count: number;
}

/**
 * State machine for incremental chunk parsing.
 *
 * The Node.js ReadStream delivers data in chunks (default 64 KiB).
 * A single chunk may split a value at any byte boundary — e.g. a
 * 9-byte number could arrive as 4 bytes in one chunk and 5 in the
 * next. The state machine tracks exactly which field is being
 * decoded so parsing can pause mid-value and resume when more data
 * arrives, without buffering the entire file.
 *
 * Transitions:
 *   NeedTag ────► NeedNum / NeedBool / NeedLen / ──► NeedTag (null)
 *   NeedLen ────► NeedVar
 *   NeedNum / NeedBool / NeedVar ────► NeedTag (value complete)
 */
enum ParseState {
  NeedTag = 0,
  NeedNum = 1,
  NeedBool = 2,
  NeedLen = 3,
  NeedVar = 4,
}

/**
 * Error thrown when the binary file is structurally invalid.
 *
 * Three conditions trigger this:
 * 1. An unknown type tag byte (value outside 0x01–0x06).
 * 2. The file ends mid-value (truncated — fewer bytes remaining than
 *    the length prefix declares).
 * 3. Invalid JSON inside an Object or Array payload.
 *
 * The `offset` property gives the byte position in the file where
 * corruption was first detected, aiding debugging.
 */
export class StreamCorruptError extends Error {
  constructor(message: string, public readonly offset: number) {
    super(`[Ink-Router-Kit] StreamingReader: ${message} at byte ${offset}.`);
    this.name = 'StreamCorruptError';
  }
}

/**
 * Sequential binary value reader backed by a Node.js ReadStream.
 *
 * Unlike {@link BinaryStorage} (which loads the entire file into one
 * Buffer), this keeps only a small working buffer (~64 KB above the
 * largest unparsed value) by:
 *
 * 1. A **state machine** (`ParseState`) that tracks which field of
 *    the current value is being decoded, so parsing can pause mid-byte
 *    and resume when the next chunk arrives.
 * 2. **Buffer trimming** (`byteTrimming` + `advanceToNeedTag`) that
 *    discards already-consumed bytes once they exceed 64 KB, keeping
 *    memory bounded regardless of file size.
 * 3. **Backpressure** (`maxQueueSize`) that pauses the underlying
 *    ReadStream when the parsed-value queue grows too large, and
 *    resumes it when consumers drain the queue.
 *
 * ## Lifecycle
 *
 * The stream starts in **paused** mode. It only resumes when there
 * is consumer demand — a `readBatch()` call with insufficient queued
 * values, or an active async-iterator `next()`. This guarantees that
 * the file descriptor is not reading ahead of what the consumer can
 * process, eliminating tail latency from excessive buffering.
 *
 * ## Error isolation
 *
 * Two separate flags track terminal states:
 * - `fatalError` — set by corrupt/truncated/I/O errors. All subsequent
 *   calls throw the error. The reader is dead.
 * - `destroyed` — set by user-initiated `destroy()`. Subsequent calls
 *   return empty results silently. Idempotent and safe.
 *
 * This distinction matters: a corrupt file must keep throwing so the
 * user knows data is lost, while a graceful shutdown should not spam
 * errors.
 */
class StreamingReader implements StreamingReaderAPI {
  private stream: fs.ReadStream;
  private buf: Buffer = Buffer.alloc(0);
  private offset: number = 0;
  private state: ParseState = ParseState.NeedTag;
  /** The type tag of the value currently being parsed (for NeedVar dispatch). */
  private currentTag: TypeTag = TypeTag.Null;
  private pendingLen: number = 0;
  private queue: unknown[] = [];
  private maxQueueSize: number;
  private streamEnded: boolean = false;
  private destroyed: boolean = false;
  /** Set when a corruption / I/O error occurs. User destroy() does NOT set this. */
  private fatalError: unknown = null;
  /**
   * Accumulated bytes discarded from the front of the internal buffer
   * via `advanceToNeedTag` trimming. Added to `this.offset` when
   * computing absolute file offsets for error messages so that even
   * after trimming 100 MB of processed data, a corrupt tag at
   * file offset 100,000,100 is reported correctly.
   */
  private byteTrimming: number = 0;
  /**
   * Absolute file offset of the most recently read type tag.
   * Used in `StreamCorruptError` to pinpoint where corruption was
   * first detected, after accounting for buffer trimming.
   */
  private lastTagOffset: number = 0;

  /** Waiters for readBatch(count) calls that haven't been satisfied yet. */
  private batchWaiters: BatchWaiter[] = [];
  /**
   * Waiters for async-iterator `next()` calls.
   * Each entry represents one `for await` iteration waiting for a
   * single value to become available.
   */
  private iterWaiters: Deferred<IteratorResult<unknown>>[] = [];

  constructor(filePath: string, options?: StreamingReaderOptions) {
    this.maxQueueSize = options?.maxQueueSize ?? 1000;

    this.stream = fs.createReadStream(filePath, {
      highWaterMark: options?.highWaterMark ?? 65536,
    });

    this.stream.on('data', (chunk) => this.onData(chunk as Buffer));
    this.stream.on('end', () => this.onEnd());
    this.stream.on('error', (err: NodeJS.ErrnoException) => this.onStreamError(err));
    this.stream.on('close', () => {
      // If the stream closes without 'end' or 'error' (possible on destroy),
      // make sure streamEnded is true so waiters don't hang.
      if (!this.streamEnded && !this.fatalError && !this.destroyed) {
        this.streamEnded = true;
        this.settleWaiters();
      }
    });

    // Start paused; resume only when there is demand.
    this.stream.pause();
  }

  // ── Public API ──────────────────────────────────────────

  async readBatch(count: number): Promise<unknown[]> {
    if (this.fatalError) throw this.fatalError;
    if (this.destroyed) return [];
    if (count <= 0) return [];

    this.parseLoop();
    if (this.fatalError) throw this.fatalError;

    if (this.queue.length > 0) {
      const result = this.drainQueue(count);
      if (result.length > 0) return result;
    }

    if (this.streamEnded) return [];

    const waiter: BatchWaiter = { deferred: new Deferred(), count };
    this.batchWaiters.push(waiter);
    this.maybeResumeStream();
    return waiter.deferred.promise;
  }

  [Symbol.asyncIterator](): AsyncIterator<unknown> {
    const reader = this;
    return {
      async next(): Promise<IteratorResult<unknown>> {
        if (reader.fatalError) throw reader.fatalError;
        if (reader.destroyed) return { done: true, value: undefined };

        reader.parseLoop();
        if (reader.fatalError) throw reader.fatalError;

        if (reader.queue.length > 0) {
          const value = reader.queue.shift()!;
          reader.maybeResumeIfLow();
          return { done: false, value };
        }

        if (reader.streamEnded) {
          return { done: true, value: undefined };
        }

        const d = new Deferred<IteratorResult<unknown>>();
        reader.iterWaiters.push(d);
        reader.maybeResumeStream();
        return d.promise;
      },
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stream.destroy();
    this.queue.length = 0;

    for (const w of this.batchWaiters) w.deferred.resolve([]);
    this.batchWaiters.length = 0;
    for (const w of this.iterWaiters) w.resolve({ done: true, value: undefined });
    this.iterWaiters.length = 0;
  }

  // ── Stream event handlers ────────────────────────────────

  private onData(chunk: Buffer): void {
    if (this.destroyed || this.fatalError) return;
    this.buf = Buffer.concat([this.buf, chunk]);
    this.parseLoop();
    this.settleWaiters();

    // Pause the underlying read stream if the value queue is full.
    // This is the core of backpressure: the consumer processes values
    // at its own pace; we don't let the OS buffer exceed maxQueueSize.
    if (this.queue.length >= this.maxQueueSize && !this.fatalError) {
      this.stream.pause();
    }
  }

  private onEnd(): void {
    if (this.destroyed || this.fatalError) return;
    this.streamEnded = true;

    // If there are leftover unprocessed bytes, the file is truncated.
    if (this.offset < this.buf.length) {
      this.fail(new StreamCorruptError(
        'Incomplete data — file truncated mid-value',
        this.byteTrimming + this.lastTagOffset,
      ));
      return;
    }

    this.settleWaiters();
  }

  private onStreamError(err: NodeJS.ErrnoException): void {
    if (this.destroyed || this.fatalError) return;
    this.streamEnded = true;
    this.fail(err);
  }

  // ── Parse state machine ──────────────────────────────────


  private parseLoop(): void {
    // Loop: keep parsing values as long as there are enough bytes
    // in the internal buffer. `return` = need more data (chunk
    // boundary hit). `continue` = finished one value, parse next.
    while (true) {
      switch (this.state) {
        // ── NeedTag ──────────────────────────────────
        // Read 1 byte, validate it's a known TypeTag (0x01–0x06),
        // then transition to the appropriate payload state.
        case ParseState.NeedTag: {
          if (this.offset + TAG_SIZE > this.buf.length) return;
          const tag = this.buf.readUInt8(this.offset);
          this.lastTagOffset = this.byteTrimming + this.offset;
          this.offset += TAG_SIZE;

          if (tag < TypeTag.Number || tag > TypeTag.Null) {
            this.fail(new StreamCorruptError(
              `Unknown type tag 0x${tag.toString(16)}`,
              this.lastTagOffset,
            ));
            return;
          }

          this.currentTag = tag as TypeTag;
          switch (tag) {
            case TypeTag.Number:
              this.state = ParseState.NeedNum;
              break;
            case TypeTag.Boolean:
              this.state = ParseState.NeedBool;
              break;
            case TypeTag.Null:
              this.queue.push(null);
              this.advanceToNeedTag();
              continue;
            default:
              // String, Object, Array — all length-prefixed.
              this.state = ParseState.NeedLen;
              break;
          }
          break;
        }

        // ── NeedNum ──────────────────────────────────
        // Expect 8 bytes of IEEE 754 float64 (little-endian).
        case ParseState.NeedNum: {
          if (this.offset + NUM_SIZE > this.buf.length) return;
          const val = this.buf.readDoubleLE(this.offset);
          this.offset += NUM_SIZE;
          this.queue.push(val);
          this.advanceToNeedTag();
          continue;
        }

        // ── NeedBool ─────────────────────────────────
        // Expect 1 byte: 0x00 = false, any non-zero = true.
        case ParseState.NeedBool: {
          if (this.offset + BOOL_SIZE > this.buf.length) return;
          const val = this.buf.readUInt8(this.offset) !== 0;
          this.offset += BOOL_SIZE;
          this.queue.push(val);
          this.advanceToNeedTag();
          continue;
        }

        // ── NeedLen ──────────────────────────────────
        // Expect 4 bytes of uint32 LE length prefix (for strings,
        // objects, arrays). Read the length then transition to
        // NeedVar to wait for the variable-length content.
        case ParseState.NeedLen: {
          if (this.offset + LEN_SIZE > this.buf.length) return;
          this.pendingLen = this.buf.readUInt32LE(this.offset);
          this.offset += LEN_SIZE;
          this.state = ParseState.NeedVar;
          break;
        }

        // ── NeedVar ──────────────────────────────────
        // Expect `pendingLen` bytes of content. Once read:
        // - TypeTag.String → push as UTF-8 string
        // - TypeTag.Object / TypeTag.Array → JSON-parse and push
        case ParseState.NeedVar: {
          if (this.offset + this.pendingLen > this.buf.length) return;
          const raw = this.buf.toString('utf-8', this.offset, this.offset + this.pendingLen);
          this.offset += this.pendingLen;

          if (this.currentTag === TypeTag.String) {
            this.queue.push(raw);
          } else {
            // Object or Array — JSON payload.
            let val: unknown;
            try {
              val = JSON.parse(raw);
            } catch {
              this.fail(new StreamCorruptError(
                'Invalid JSON in variable-length payload',
                this.lastTagOffset,
              ));
              return;
            }
            this.queue.push(val);
          }
          this.advanceToNeedTag();
          continue;
        }

        default:
          return;
      }
    }
  }

  private advanceToNeedTag(): void {
    this.state = ParseState.NeedTag;
    // Periodically discard already-consumed bytes from the front of
    // the internal buffer so memory doesn't grow unboundedly with
    // file size. The threshold (65536 = 64 KB) means we waste at
    // most 64 KB beyond the data currently being parsed, regardless
    // of whether the file is 1 MB or 100 GB.
    //
    // We use `this.buf.subarray()` (zero-copy view) instead of
    // `Buffer.from()` (copy) to keep trimming O(1). The original
    // backing ArrayBuffer is retained until all views are GC'd, but
    // since we're trimming in ~64 KB increments, the retained window
    // is negligible compared to the total file size.
    if (this.offset > 65536) {
      this.byteTrimming += this.offset;
      this.buf = this.buf.subarray(this.offset);
      this.offset = 0;
    }
  }

  // ── Waiter management ────────────────────────────────────


  /**
   * Resolve as many batch and iterator waiters as possible.
   *
   * Called after every `onData` (new values may have been parsed) and
   * on `onEnd` / `onStreamError`. For batch waiters, if the queue has
   * at least `count` items we drain immediately. For iterator waiters
   * we deliver one value at a time.
   *
   * If a fatal error occurred, all waiters are rejected so the
   * consumer sees the error at its await point.
   */
  private settleWaiters(): void {
    // Batch waiters.
    let i = 0;
    while (i < this.batchWaiters.length) {
      const w = this.batchWaiters[i];
      if (this.fatalError) {
        w.deferred.reject(this.fatalError);
        this.batchWaiters.splice(i, 1);
        continue;
      }
      if (this.queue.length >= w.count || (this.streamEnded && this.queue.length > 0)) {
        w.deferred.resolve(this.drainQueue(w.count));
        this.batchWaiters.splice(i, 1);
      } else if (this.streamEnded && this.queue.length === 0) {
        w.deferred.resolve([]);
        this.batchWaiters.splice(i, 1);
      } else {
        i++;
      }
    }

    // Iterator waiters.
    i = 0;
    while (i < this.iterWaiters.length) {
      const w = this.iterWaiters[i];
      if (this.fatalError) {
        w.reject(this.fatalError);
        this.iterWaiters.splice(i, 1);
        continue;
      }
      if (this.queue.length > 0) {
        const value = this.queue.shift()!;
        w.resolve({ done: false, value });
        this.iterWaiters.splice(i, 1);
        this.maybeResumeIfLow();
      } else if (this.streamEnded) {
        w.resolve({ done: true, value: undefined });
        this.iterWaiters.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  /**
   * Extract up to `count` values from the queue and hand them to the
   * consumer. Resumes the underlying stream if the queue drops below
   * maxQueueSize (backpressure release).
   */
  private drainQueue(count: number): unknown[] {
    const take = Math.min(count, this.queue.length);
    const result = this.queue.splice(0, take);
    this.maybeResumeIfLow();
    return result;
  }

  /**
   * Transition to the fatal-error state.
   *
   * - Sets `fatalError` so all future calls throw.
   * - Destroys the underlying ReadStream (file descriptor is closed).
   * - Rejects all pending waiters so no consumer hangs.
   *
   * The caller guarantees that the error is non-recoverable — corrupt
   * data, I/O failure, or truncated file. User-initiated `destroy()`
   * does NOT call this method; it sets `destroyed` instead.
   */
  private fail(err: unknown): void {
    this.fatalError = err;
    this.stream.destroy();

    for (const w of this.batchWaiters) w.deferred.reject(err);
    this.batchWaiters.length = 0;
    for (const w of this.iterWaiters) w.reject(err);
    this.iterWaiters.length = 0;
  }

  /**
   * Resume the underlying stream if it is currently paused and the
   * reader is still active. Used when a consumer calls readBatch or
   * iterator next() and there aren't enough queued values yet.
   */
  private maybeResumeStream(): void {
    if (!this.streamEnded && !this.destroyed && !this.fatalError && this.stream.isPaused()) {
      this.stream.resume();
    }
  }

  /**
   * Resume the underlying stream if the queue has drained below the
   * maxQueueSize threshold. This is the backpressure release — called
   * after each value is consumed (drainQueue or iterator shift).
   */
  private maybeResumeIfLow(): void {
    if (
      !this.streamEnded &&
      !this.destroyed &&
      !this.fatalError &&
      this.queue.length < this.maxQueueSize &&
      this.stream.isPaused()
    ) {
      this.stream.resume();
    }
  }
}

/**
 * Create a streaming binary reader for a file.
 *
 * Unlike {@link createBinaryStorage} (which loads the entire file into
 * memory), this reads values sequentially from disk via a Node.js
 * `ReadStream`. Values are parsed one at a time and returned in
 * complete batches — the user never sees partial / truncated data.
 *
 * @param filePath — Absolute or relative path to the binary file.
 * @param options  — Optional tuning knobs (queue size, chunk size).
 * @returns A reader with `readBatch()`, async iteration, and `destroy()`.
 *
 * @example
 * ```ts
 * import { createStreamingReader } from '@baigao_h/ink-kit';
 *
 * const reader = createStreamingReader('large.bin');
 *
 * let batch;
 * while ((batch = await reader.readBatch(1000)).length > 0) {
 *   for (const value of batch) {
 *     console.log(value);
 *   }
 * }
 *
 * // Or: async iteration
 * for await (const value of reader) {
 *   console.log(value);
 * }
 * ```
 *
 * @throws `ENOENT` if the file does not exist.
 * @throws `StreamCorruptError` if the file is corrupt or truncated.
 */
export function createStreamingReader(
  filePath: string,
  options?: StreamingReaderOptions,
): StreamingReaderAPI {
  fs.accessSync(filePath, fs.constants.R_OK);
  return new StreamingReader(filePath, options);
}

export type { StreamingReaderOptions, StreamingReaderAPI };
