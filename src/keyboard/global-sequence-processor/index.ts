import type {
  PipelineContext,
  PipelineProcessor,
  ResolvedGlobalSequenceEntry,
  GlobalPendingSequence,
} from '../types.js';

const DEFAULT_SEQUENCE_TIMEOUT = 500;

/**
 * Try to start a global pending sequence from a specific affectOverlay group.
 *
 * Iterates the candidate entries, filters by affectOverlay, category,
 * and cover/override constraints, and creates a pending sequence when
 * the first key matches.
 *
 * @param entries        Candidate global sequence entries.
 * @param affectOverlay  Which group to filter (true = overlay-phase, false = screen-phase).
 * @param ctx            Full pipeline context.
 * @returns true when a new pending sequence was started (event consumed).
 *
 * @2026-06-14 v3.4.0
 */
function tryStartGlobalSequence(
  entries: ResolvedGlobalSequenceEntry[],
  affectOverlay: boolean,
  ctx: PipelineContext,
): boolean {
  for (const entry of entries) {
    if ((entry.affectOverlay ?? false) !== affectOverlay) continue;
    if (affectOverlay && ctx.activeCount === 0 && !entry.executeWhenNoOverlay) continue;
    if (!ctx.topComponent) continue;

    const cat = entry.category;
    if (cat !== undefined && cat !== '*') {
      if (Array.isArray(cat) && cat.length === 0) continue;
      if (Array.isArray(cat) && !cat.includes(ctx.topComponent)) continue;
    }

    // Cover check: only boundSequence can override a global sequence.
    // boundKeyboard is never checked — its keys are single-key bindings
    // that the sequence system always consumes first.
    if (entry.cover !== false) {
      const firstKey = entry.keys[0];
      if (affectOverlay) {
        let anyOverlayHasOverride = false;
        for (const overlay of ctx.activeOverlays) {
          const overlayLayer = ctx.layersRef.current.get(overlay.id);
          if (overlayLayer?.sequences.has(firstKey)) {
            anyOverlayHasOverride = true;
            break;
          }
        }
        if (anyOverlayHasOverride) continue;
      } else {
        if (ctx.topComponent) {
          const topLayer = ctx.layersRef.current.get(ctx.topComponent);
          if (topLayer?.sequences.has(firstKey)) continue;
        }
      }
    }

    if (ctx.eventNames.includes(entry.keys[0])) {
      const timeout = entry.timeout ?? DEFAULT_SEQUENCE_TIMEOUT;
      const pending: GlobalPendingSequence = {
        sequences: entry.keys,
        nextIndex: 1,
        handler: entry.operate,
        timer: undefined as unknown as ReturnType<typeof setTimeout>,
        timeout,
        exclusive: entry.exclusive ?? false,
        affectOverlay,
        cover: entry.cover ?? true,
        category: entry.category,
        executeWhenNoOverlay: entry.executeWhenNoOverlay,
      };
      const timer = setTimeout(() => {
        if (ctx.pendingSeqRef.current === pending) {
          ctx.pendingSeqRef.current = null;
        }
      }, timeout);
      pending.timer = timer;
      ctx.pendingSeqRef.current = pending;
      return true;
    }
  }
  return false;
}

/**
 * Process the currently active global pending sequence.
 *
 * Matches the next expected key, handles exclusive vs non-exclusive
 * mismatch behaviour, and fires the handler when the full sequence
 * is completed.
 *
 * @param ctx  Full pipeline context.
 * @returns true when the event was consumed by the pending sequence.
 *
 * @2026-06-14 v3.4.0
 */
function processGlobalPending(ctx: PipelineContext): boolean {
  const pending = ctx.pendingSeqRef.current;
  if (pending === null) return false;

  if (pending.affectOverlay && ctx.activeCount === 0 && !pending.executeWhenNoOverlay) {
    clearTimeout(pending.timer);
    ctx.pendingSeqRef.current = null;
    return false;
  }

  const expectedKey = pending.sequences[pending.nextIndex];
  if (ctx.eventNames.includes(expectedKey)) {
    clearTimeout(pending.timer);
    pending.nextIndex++;
    if (pending.nextIndex === pending.sequences.length) {
      pending.handler();
      ctx.pendingSeqRef.current = null;
    } else {
      pending.timer = setTimeout(() => {
        if (ctx.pendingSeqRef.current === pending) {
          ctx.pendingSeqRef.current = null;
        }
      }, pending.timeout);
    }
    return true;
  }

  if (pending.exclusive) {
    // Exclusive mode: silently consume the mismatched key, keep waiting.
    return true;
  }
  // Non-exclusive (default): cancel the sequence, key falls through.
  clearTimeout(pending.timer);
  ctx.pendingSeqRef.current = null;
  return false;
}

/**
 * Create a processor for global multi-key sequences.
 *
 * Handles two sub-steps in order:
 * 1. Drain any active global pending sequence.
 * 2. Try to start a new sequence from registered entries.
 *
 * @param config.affectOverlay - Which priority group this processor serves.
 * @returns A PipelineProcessor for the global sequence stage.
 */
export function createGlobalSequenceProcessor(config: {
  affectOverlay: boolean;
}): PipelineProcessor {
  const { affectOverlay } = config;
  return {
    process(ctx: PipelineContext): boolean {
      if (processGlobalPending(ctx)) return true;
      if (tryStartGlobalSequence(ctx.globalSequences, affectOverlay, ctx)) return true;
      return false;
    },
  };
}
