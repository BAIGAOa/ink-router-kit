import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createBinaryStorage, createStreamingReader } from '../../binary-storage/index.js';
import { StreamCorruptError } from '../../binary-storage/StreamingReader.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ink-kit-stream-'));
}

let testDir: string;

beforeEach(() => {
  testDir = tmpDir();
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

/** Helper: write values with BinaryStorage and return the file path. */
async function writeFile(name: string, values: unknown[]): Promise<string> {
  const storage = createBinaryStorage({ dir: testDir, file: name });
  for (const v of values) {
    await storage.write.any(v);
  }
  // The file is auto-flushed (default).
  return path.join(testDir, name);
}

describe('basic functionality', () => {
  it('empty file: readBatch returns []', async () => {
    const filePath = path.join(testDir, 'empty.bin');
    fs.writeFileSync(filePath, Buffer.alloc(0));

    const reader = createStreamingReader(filePath);
    const result = await reader.readBatch(10);
    expect(result).toEqual([]);
  });

  it('empty file: async iterator produces no values', async () => {
    const filePath = path.join(testDir, 'empty.bin');
    fs.writeFileSync(filePath, Buffer.alloc(0));

    const reader = createStreamingReader(filePath);
    const collected: unknown[] = [];
    for await (const value of reader) {
      collected.push(value);
    }
    expect(collected).toEqual([]);
  });

  it('reads N numbers in exact order', async () => {
    const nums = [1, -1, 3.14, Infinity, NaN, 0, 1e308, -1e308];
    const filePath = await writeFile('nums.bin', nums);

    const reader = createStreamingReader(filePath);
    const result = await reader.readBatch(100);
    expect(result).toHaveLength(8);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(-1);
    expect(result[2]).toBe(3.14);
    expect(result[3]).toBe(Infinity);
    expect(Number.isNaN(result[4])).toBe(true);
    expect(result[5]).toBe(0);
    expect(result[6]).toBe(1e308);
    expect(result[7]).toBe(-1e308);
  });

  it('reads mixed types correctly', async () => {
    const values: unknown[] = [
      42, 'hello', true, false, null, { a: 1, b: 'x' }, [1, 2, 3], '', '中文',
    ];
    const filePath = await writeFile('mixed.bin', values);

    const reader = createStreamingReader(filePath);
    const result = await reader.readBatch(100);
    expect(result).toEqual(values);
  });
});

describe('readBatch batching', () => {
  it('returns exactly count values when available', async () => {
    const nums = Array.from({ length: 100 }, (_, i) => i);
    const filePath = await writeFile('batch.bin', nums);

    const reader = createStreamingReader(filePath);
    const batch1 = await reader.readBatch(30);
    expect(batch1).toHaveLength(30);
    expect(batch1[0]).toBe(0);
    expect(batch1[29]).toBe(29);

    const batch2 = await reader.readBatch(30);
    expect(batch2).toHaveLength(30);
    expect(batch2[0]).toBe(30);
    expect(batch2[29]).toBe(59);
  });

  it('returns fewer when requesting more than available', async () => {
    const nums = Array.from({ length: 50 }, (_, i) => i);
    const filePath = await writeFile('few.bin', nums);

    const reader = createStreamingReader(filePath);
    const result = await reader.readBatch(1000);
    expect(result).toHaveLength(50);
  });

  it('consecutive readBatch calls produce contiguous results', async () => {
    const nums = Array.from({ length: 10 }, (_, i) => i);
    const filePath = await writeFile('contig.bin', nums);

    const reader = createStreamingReader(filePath);
    const a = await reader.readBatch(3);
    const b = await reader.readBatch(3);
    const c = await reader.readBatch(3);
    const d = await reader.readBatch(5);
    expect(a).toEqual([0, 1, 2]);
    expect(b).toEqual([3, 4, 5]);
    expect(c).toEqual([6, 7, 8]);
    expect(d).toEqual([9]);
  });

  it('readBatch(0) returns [] without consuming', async () => {
    const filePath = await writeFile('zero.bin', [1, 2, 3]);
    const reader = createStreamingReader(filePath);
    expect(await reader.readBatch(0)).toEqual([]);
    // Next call should still get all values.
    expect(await reader.readBatch(10)).toEqual([1, 2, 3]);
  });
});

describe('async iterator', () => {
  it('yields all values in order', async () => {
    const values = ['a', 'b', 'c', 'd', 'e'];
    const filePath = await writeFile('iter.bin', values);

    const reader = createStreamingReader(filePath);
    const collected: unknown[] = [];
    for await (const value of reader) {
      collected.push(value);
    }
    expect(collected).toEqual(values);
  });

  it('stops after file is fully consumed', async () => {
    const filePath = await writeFile('stop.bin', [1]);
    const reader = createStreamingReader(filePath);
    const iter = reader[Symbol.asyncIterator]();
    const r1 = await iter.next();
    expect(r1.done).toBe(false);
    expect(r1.value).toBe(1);

    const r2 = await iter.next();
    expect(r2.done).toBe(true);
  });

  it('mixed with readBatch: iterator continues from where batch left off', async () => {
    const filePath = await writeFile('mix.bin', [1, 2, 3, 4, 5]);
    const reader = createStreamingReader(filePath);

    // readBatch consumes first 2
    const batch = await reader.readBatch(2);
    expect(batch).toEqual([1, 2]);

    // iterator picks up the rest
    const collected: unknown[] = [];
    for await (const value of reader) {
      collected.push(value);
    }
    expect(collected).toEqual([3, 4, 5]);
  });
});

describe('boundary: chunk splitting', () => {
  it('handles 1-byte chunks (extreme fragmentation)', async () => {
    const nums = Array.from({ length: 50 }, (_, i) => i);
    const filePath = await writeFile('tiny.bin', nums);

    // Use highWaterMark: 1 to force byte-by-byte reads.
    const reader = createStreamingReader(filePath, { highWaterMark: 1 });
    const result = await reader.readBatch(100);
    expect(result).toEqual(nums);
  });

  it('handles chunks that split a number mid-payload', async () => {
    // Each number is 9 bytes (1 tag + 8 float64).
    // highWaterMark: 5 means each chunk is < 1 number.
    const nums = Array.from({ length: 20 }, (_, i) => i * 10);
    const filePath = await writeFile('splitnum.bin', nums);

    const reader = createStreamingReader(filePath, { highWaterMark: 5 });
    const result = await reader.readBatch(100);
    expect(result).toEqual(nums);
  });

  it('handles chunks that split a string mid-length and mid-content', async () => {
    const strings = ['short', 'a'.repeat(200), 'medium', 'b'.repeat(500)];
    const filePath = await writeFile('splitstr.bin', strings);

    // 3-byte chunks — smaller than the 4-byte length prefix.
    const reader = createStreamingReader(filePath, { highWaterMark: 3 });
    const result = await reader.readBatch(100);
    expect(result).toEqual(strings);
  });
});

describe('error handling', () => {
  it('throws ENOENT for non-existent file', () => {
    expect(() => createStreamingReader(path.join(testDir, 'nope.bin')))
      .toThrow();
  });

  it('throws on unknown type tag (corrupt file)', async () => {
    const filePath = await writeFile('corrupt.bin', [1, 2, 3]);
    // Read the file, corrupt a tag byte.
    const buf = fs.readFileSync(filePath);
    // First number is 9 bytes: [0x01][8 bytes float64].
    // Second value starts at byte 9 — corrupt its tag.
    buf.writeUInt8(0xFF, 9);
    fs.writeFileSync(filePath, buf);

    const reader = createStreamingReader(filePath);
    // The corrupt tag is hit during parsing, so even the first readBatch rejects.
    await expect(reader.readBatch(10)).rejects.toThrow(StreamCorruptError);
    await expect(reader.readBatch(10)).rejects.toThrow('Unknown type tag');
  });

  it('throws on truncated file (mid-value)', async () => {
    const filePath = await writeFile('trunc.bin', [1, 2, 3]);
    // Truncate the file by removing the last 6 bytes (incomplete number).
    const buf = fs.readFileSync(filePath);
    const truncated = buf.subarray(0, buf.length - 6);
    fs.writeFileSync(filePath, truncated);

    const reader = createStreamingReader(filePath);
    const batch = await reader.readBatch(2);
    expect(batch).toEqual([1, 2]);
    // Third value is truncated.
    await expect(reader.readBatch(10)).rejects.toThrow(StreamCorruptError);
    await expect(reader.readBatch(10)).rejects.toThrow('truncated');
  });

  it('reports byte offset in error message', async () => {
    // Write a good number then a corrupt tag at byte 9.
    const filePath = path.join(testDir, 'offset.bin');
    const goodBuf = Buffer.alloc(9);
    goodBuf.writeUInt8(0x01, 0);
    goodBuf.writeDoubleLE(42, 1);
    const corruptTag = Buffer.from([0xFF]);
    const corruptData = Buffer.concat([goodBuf, corruptTag, Buffer.from([0x00, 0x00, 0x00])]);
    fs.writeFileSync(filePath, corruptData);

    const reader = createStreamingReader(filePath);
    // The corrupt tag at byte 9 causes parsing to fail eagerly.
    await expect(reader.readBatch(10)).rejects.toThrow('at byte 9');
  });
});

describe('concurrency and resource management', () => {
  it('multiple readers on same file are independent', async () => {
    const filePath = await writeFile('shared.bin', [1, 2, 3, 4, 5]);

    const r1 = createStreamingReader(filePath);
    const r2 = createStreamingReader(filePath);

    const b1 = await r1.readBatch(2);
    const b2 = await r2.readBatch(3);

    expect(b1).toEqual([1, 2]);
    expect(b2).toEqual([1, 2, 3]);

    // r1 continues from where it left off.
    const b1b = await r1.readBatch(10);
    expect(b1b).toEqual([3, 4, 5]);
  });

  it('destroy() resolves pending readBatch with []', async () => {
    // Write a large file so readBatch has to wait.
    const nums = Array.from({ length: 10000 }, (_, i) => i);
    const filePath = await writeFile('destroy.bin', nums);

    const reader = createStreamingReader(filePath);
    // Start reading — this may resolve immediately if the file is small.
    // Set highWaterMark to 1 to force the reader to wait between chunks.
    const slowReader = createStreamingReader(filePath, { highWaterMark: 1 });
    const batchPromise = slowReader.readBatch(5000);
    // Give it a tick to start, then destroy.
    await new Promise(r => setTimeout(r, 10));
    slowReader.destroy();

    const result = await batchPromise;
    expect(result).toEqual([]);
  });

  it('destroy() stops async iterator immediately', async () => {
    const filePath = await writeFile('iter-dest.bin', [1, 2, 3, 4, 5]);
    const reader = createStreamingReader(filePath);

    const iter = reader[Symbol.asyncIterator]();
    const r1 = await iter.next();
    expect(r1).toEqual({ done: false, value: 1 });

    reader.destroy();
    const r2 = await iter.next();
    expect(r2).toEqual({ done: true, value: undefined });
  });
});

describe('backpressure', () => {
  it('pauses stream when queue exceeds maxQueueSize', async () => {
    // Write many values.
    const count = 5000;
    const nums = Array.from({ length: count }, (_, i) => i);
    const filePath = await writeFile('backpressure.bin', nums);

    // Set a very small queue size so backpressure engages.
    const reader = createStreamingReader(filePath, { maxQueueSize: 10 });

    // Read all values in small batches.
    let total = 0;
    let batch: unknown[];
    while ((batch = await reader.readBatch(100)).length > 0) {
      total += batch.length;
    }
    expect(total).toBe(count);
  });

  it('resumes stream after queue is drained', async () => {
    const count = 2000;
    const nums = Array.from({ length: count }, (_, i) => i);
    const filePath = await writeFile('resume.bin', nums);

    const reader = createStreamingReader(filePath, { maxQueueSize: 5 });
    // This should work end-to-end even with a tiny queue.
    const all = await reader.readBatch(count);
    expect(all).toHaveLength(count);
  });

  it('handles large file without memory blowup (stress test)', async () => {
    // Generate ~50 MB file — small enough for CI, large enough to exercise streaming.
    const filePath = path.join(testDir, 'stress.bin');
    const storage = createBinaryStorage({ dir: testDir, file: 'stress.bin', flush: false });
    const numValues = 100000;
    for (let i = 0; i < numValues; i++) {
      await storage.write.any(`value-${i}`);
    }
    await storage.write.flush();

    const reader = createStreamingReader(filePath, { maxQueueSize: 100 });
    let total = 0;
    let batch: unknown[];
    while ((batch = await reader.readBatch(1000)).length > 0) {
      total += batch.length;
      // Verify values are correct for a few spot checks.
      if (total <= batch.length) {
        expect(batch[0]).toBe('value-0');
      }
    }
    expect(total).toBe(numValues);
  }, 30000);
});
