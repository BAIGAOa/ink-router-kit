/**
 * Streaming Reader Demo
 *
 * This example demonstrates how to:
 * 1. Write a large sequence of values using `createBinaryStorage`
 * 2. Read them back with `createStreamingReader` using `readBatch`
 * 3. Read them back with async iteration
 * 4. Handle backpressure by setting a small queue size
 *
 * Run:
 *   npx tsx examples/streaming-reader-demo.ts
 */

import { createBinaryStorage, createStreamingReader } from '../src/index.js';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-kit-demo-'));
const filePath = path.join(tmpDir, 'events.bin');

async function main() {
  // ── 1. Write 100,000 events ───────────────────────────────
  console.log('Writing 100,000 events...');
  const storage = createBinaryStorage({ dir: tmpDir, file: 'events.bin', flush: false });

  for (let i = 0; i < 100_000; i++) {
    await storage.write.any({
      id: i,
      type: i % 2 === 0 ? 'click' : 'scroll',
      timestamp: Date.now(),
      value: Math.random(),
    });
  }
  await storage.write.flush();
  console.log(`Wrote ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(1)} MB`);

  // ── 2. Stream-read in batches of 500 ──────────────────────
  console.log('\nReading in batches of 500...');
  const reader1 = createStreamingReader(filePath);
  let total = 0;
  let batch: unknown[];

  while ((batch = await reader1.readBatch(500)).length > 0) {
    total += batch.length;
    if (total <= 1000) {
      // Print first two batches
      console.log(`  Batch of ${batch.length}: first item ID = ${(batch[0] as any).id}`);
    }
  }
  console.log(`  Total values read: ${total}`);

  // ── 3. Read with async iteration ──────────────────────────
  console.log('\nReading with async iterator...');
  const reader2 = createStreamingReader(filePath);
  let count = 0;
  for await (const value of reader2) {
    count++;
    if (count === 1) {
      console.log(`  First value: id=${(value as any).id}, type=${(value as any).type}`);
    }
  }
  console.log(`  Total values iterated: ${count}`);

  // ── 4. Backpressure demo with tiny queue ──────────────────
  console.log('\nBackpressure demo (maxQueueSize: 5)...');
  const reader3 = createStreamingReader(filePath, { maxQueueSize: 5 });
  let processed = 0;
  while ((batch = await reader3.readBatch(100)).length > 0) {
    processed += batch.length;
    // Simulate slow processing: yield to event loop every 1000 items
    if (processed % 10_000 === 0) {
      console.log(`  Processed ${processed} values so far (queue forced small)`);
    }
  }
  console.log(`  Done: ${processed} values with tight backpressure`);

  // ── Cleanup ───────────────────────────────────────────────
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('\nCleaned up temp files.');
}

main().catch(console.error);
