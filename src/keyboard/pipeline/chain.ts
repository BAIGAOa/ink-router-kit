import type { PipelineContext, PipelineProcessor } from '../types.js';
import { createGlobalSequenceProcessor } from '../global-sequence-processor/index.js';
import { createGlobalKeyProcessor } from '../global-key-processor/index.js';
import { createOverlayProcessor } from '../overlay-processor/index.js';
import { createScreenStackProcessor } from '../screen-stack-processor/index.js';

/**
 * Build the canonical 6-stage processor chain.
 *
 * Priority order (highest first):
 *   ① GlobalSequence (affectOverlay: true)  — pending + start
 *   ② GlobalKey      (affectOverlay: true)  — fire before overlays
 *   ③ Overlay broadcast                      — all active overlays, zIndex asc
 *   ④ GlobalSequence (affectOverlay: false) — pending + start
 *   ⑤ GlobalKey      (affectOverlay: false) — fire before screen stack
 *   ⑥ Screen stack                           — top → bottom, only if no overlay consumed
 *
 * @2026-06-14 v3.4.0
 */
function buildProcessors(): PipelineProcessor[] {
  return [
    createGlobalSequenceProcessor({ affectOverlay: true }),
    createGlobalKeyProcessor({ affectOverlay: true }),
    createOverlayProcessor(),
    createGlobalSequenceProcessor({ affectOverlay: false }),
    createGlobalKeyProcessor({ affectOverlay: false }),
    createScreenStackProcessor(),
  ];
}

/**
 * Run a keyboard event through the full processor chain.
 *
 * Each processor's {@link PipelineProcessor.process} is called in order.
 * The first processor to return `true` (event consumed) stops the chain.
 *
 * @param ctx - Snapshot context built by {@link buildPipelineContext}.
 */
export function runPipeline(ctx: PipelineContext): void {
  const processors = buildProcessors();
  for (const processor of processors) {
    if (processor.process(ctx)) return;
  }
}
