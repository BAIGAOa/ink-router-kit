# Binary Storage System

ink-kit provides **two binary storage modes** for ordered, typed data: an in-memory random-access mode and a streaming mode for large files. Both use the same binary encoding format (1-byte type tag + type-specific payload), so files written by one mode can be read by the other.

---

## Quick Comparison

| Feature | `createBinaryStorage` | `createStreamingReader` |
|---------|----------------------|------------------------|
| Memory | Entire file in Buffer | ~64 KB working set |
| Access | Random (seek/tell/reset) | Sequential only |
| Write | Yes (append + flush) | No (read-only) |
| Best for | Small files, replay buffers, checkpoints | Files > 500 MB, backpressure-sensitive pipelines |

---

## Streaming Reader (new in v1.x)

### When to use it

- Your binary file exceeds 500 MB and loading it into memory would cause OOM.
- You need to process values one batch at a time with bounded memory.
- You want `for await` iteration over millions of records.
- You need backpressure — the reader adapts to your processing speed.

### Installation

The streaming reader is part of `@baigao_h/ink-kit` — no extra dependency.

```ts
import { createStreamingReader } from '@baigao_h/ink-kit';
import type { StreamingReaderOptions } from '@baigao_h/ink-kit';
```

### How it works

`createStreamingReader(filePath, options?)` opens the file as a Node.js `ReadStream` and incrementally parses the binary values using a **state machine**. The state machine tracks exactly which field of the current value is being decoded (tag, number payload, boolean payload, length prefix, or variable-length content), so parsing can pause mid-byte when a chunk boundary falls inside a value and resume seamlessly when the next chunk arrives.

The stream starts **paused** and only resumes when a consumer requests data. This ensures the file descriptor never reads ahead of what the application can process.

#### Backpressure

The internal queue holds at most `maxQueueSize` parsed values (default 1000). When the queue fills up, the underlying ReadStream is paused. As the consumer drains the queue, the stream resumes. This keeps memory bounded regardless of file size.

#### Memory management

Already-consumed bytes are trimmed from the front of the internal buffer once they exceed 64 KB. This means the reader's heap usage stays approximately `maxParseChunk + 64 KB + maxQueueSize × averageValueSize` — typically under 50 MB for any file size.

### API Reference

#### `createStreamingReader(filePath, options?)`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `filePath` | `string` | — | Path to the binary file (relative paths resolve to `process.cwd()`) |
| `options.highWaterMark` | `number` | `65536` | Chunk size for `fs.createReadStream` (bytes). Smaller = more I/O calls, less per-chunk latency |
| `options.maxQueueSize` | `number` | `1000` | Max parsed values buffered before backpressure kicks in |

**Throws**: `ENOENT` if the file does not exist. `StreamCorruptError` if the file is corrupt or truncated.

#### `reader.readBatch(count: number): Promise<unknown[]>`

Read up to `count` complete values. Returns fewer than `count` only when the file is exhausted. Never returns partial values — every element in the array is fully decoded.

```ts
const reader = createStreamingReader('events.bin');
let batch;
while ((batch = await reader.readBatch(1000)).length > 0) {
  for (const event of batch) {
    processEvent(event);
  }
}
```

Returns `[]` at end-of-stream.

#### `reader[Symbol.asyncIterator](): AsyncIterator<unknown>`

Iterate over every value one by one:

```ts
for await (const value of reader) {
  console.log(value);
}
```

The iterator ends naturally when the file is fully consumed. Errors (corruption, truncation) are thrown inside the loop body.

You can freely interleave `readBatch()` and `for await` — the cursor is shared.

#### `reader.destroy(): void`

Close the underlying file descriptor and release resources. Idempotent — safe to call multiple times. Pending `readBatch()` calls resolve with `[]`; the async iterator stops immediately.

### Error handling

| Condition | Behaviour |
|-----------|-----------|
| File does not exist | `createStreamingReader` throws synchronously (`ENOENT`) |
| Unknown type tag (corruption) | `readBatch`/`for await` throws `StreamCorruptError` with the byte offset |
| File truncated mid-value | `StreamCorruptError` with message 'Incomplete data — file truncated mid-value' |
| Invalid JSON in object/array payload | `StreamCorruptError` with 'Invalid JSON in variable-length payload' |
| Empty file | `readBatch` returns `[]`, `for await` produces no values |
| File read error (e.g. permission) | Propagates as underlying `fs.ReadStream` error |

After any error, the reader enters a **fatal** state — all subsequent calls throw the same error. This guarantees you never read past corrupted data. Call `destroy()` to release the file descriptor.

---

## Binary Storage (original mode)

For full documentation of the in-memory random-access mode, see [`BinaryStorage`](./BinaryStorage.ts).

```ts
import { createBinaryStorage } from '@baigao_h/ink-kit';

const bin = createBinaryStorage({ file: 'checkpoint.bin' });
await bin.write.num(Date.now());
await bin.write.str('checkpoint-1');
await bin.write.obj({ x: 100, y: 200 });

bin.resetRead();
const ts = await bin.read.num();  // timestamp
const name = await bin.read.str();
const pos = await bin.read.obj();
```

---

## Binary Format

```
[1 byte TypeTag] [payload...]

Number:  [0x01] [8 bytes float64 LE]
String:  [0x02] [4 bytes uint32 LE length] [UTF-8 bytes]
Boolean: [0x03] [1 byte: 0x00=false, 0x01=true]
Object:  [0x04] [4 bytes uint32 LE length] [JSON UTF-8 bytes]
Array:   [0x05] [4 bytes uint32 LE length] [JSON UTF-8 bytes]
Null:    [0x06]
```

Both modes use the same format, so you can write with `BinaryStorage` and read with `StreamingReader` (or vice versa).
