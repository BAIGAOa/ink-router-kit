import { BinaryStorage } from './BinaryStorage.js';
import type { BinaryStorageOptions, BinaryStorageAPI } from './types.js';

/**
 * Create a sequential binary storage station.
 *
 * Unlike {@link createStorage} (which is a key-value store backed by
 * JSON), this creates a FIFO binary stream ideal for ordered data
 * where keys are unnecessary overhead:
 *
 * - **Game replay recording** — timestamp, action, position per frame
 * - **Sensor data logging** — time series of numeric readings
 * - **Chat / event logs** — append-only sequential messages
 * - **Checkpoint chains** — ordered snapshots of application state
 *
 * ## How it works
 *
 * Each value written to the stream is encoded with a 1-byte type tag
 * followed by its payload. Reading consumes values in the same order.
 * This guarantees type safety at the individual value level — if you
 * call `read.num()` on a position that contains a string, you get an
 * immediate error with the exact byte offset.
 *
 * The read and write cursors are independent, so you can write a
 * sequence, `resetRead()`, and replay it immediately — all from
 * memory, no disk I/O needed.
 *
 * ## Binary format
 *
 * ```
 * [1 byte TypeTag] [payload...]
 *
 * Number:  [0x01] [8 bytes float64 LE]
 * String:  [0x02] [4 bytes uint32 LE length] [UTF-8 bytes]
 * Boolean: [0x03] [1 byte: 0x00=false, 0x01=true]
 * Object:  [0x04] [4 bytes uint32 LE length] [JSON UTF-8 bytes]
 * Array:   [0x05] [4 bytes uint32 LE length] [JSON UTF-8 bytes]
 * Null:    [0x06]
 * ```
 *
 * @param options  Optional directory, file name, and flush behaviour.
 * @returns A typed binary storage API with positional read/write
 *          cursors and full seek/truncate support.
 *
 * @example
 * ```ts
 * import { createBinaryStorage } from '@baigao_h/ink-kit';
 *
 * const bin = createBinaryStorage({ file: 'replay.bin' });
 *
 * // ── Recording phase ──
 * await bin.write.num(Date.now());   // timestamp
 * await bin.write.str('attack');     // action
 * await bin.write.num(120);          // damage
 * await bin.write.b(true);           // critical hit
 *
 * // ── Playback phase ──
 * bin.resetRead();
 * while (bin.tellRead() < bin.tellWrite()) {
 *   const ts     = await bin.read.num();
 *   const action = await bin.read.str();
 *   const damage = await bin.read.num();
 *   const crit   = await bin.read.b();
 *   console.log(`${ts}: ${action} for ${damage} (crit=${crit})`);
 * }
 *
 * // ── Bookmarking ──
 * bin.resetRead();
 * await bin.read.num();  // skip timestamp
 * const pos = bin.tellRead();
 * // ... later ...
 * bin.seekRead(pos);     // re-read from action
 * ```
 *
 * @throws Never throws during construction. Read errors (type
 *         mismatch, end of stream) are thrown as Promise rejections.
 *         Write errors from the filesystem propagate as standard
 *         Node.js exceptions.
 */
export function createBinaryStorage(options?: BinaryStorageOptions): BinaryStorageAPI {
  return new BinaryStorage(options);
}

export type { BinaryStorageOptions, BinaryStorageAPI };

/**
 * Low-level exports for advanced use cases.
 *
 * `TypeTag` is the numeric enum of type markers (0x01–0x06).
 * `TAG_NAMES` maps each tag to its human-readable name.
 *
 * These are useful if you need to inspect or manipulate binary
 * storage files outside the normal read/write API.
 */
export { TypeTag, TAG_NAMES } from './types.js';
export { createStreamingReader, StreamCorruptError } from './StreamingReader.js';
export type { StreamingReaderOptions, StreamingReaderAPI } from './types.js';
