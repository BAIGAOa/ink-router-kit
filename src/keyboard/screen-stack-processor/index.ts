import type { PipelineContext, PipelineProcessor } from '../types.js';
import { handleLayer } from '../layer-handler.js';

/**
 * Create a processor for the screen stack stage.
 *
 * Only runs when no overlay consumed the event (`anyOverlayConsumed`
 * is false). Iterates the screen path from top to bottom, offering
 * the event to each layer via {@link handleLayer}. The first layer
 * that returns `true` stops the iteration.
 *
 * @returns A PipelineProcessor for the screen stack stage.
 *
 * @2026-06-14 v3.4.0
 */
export function createScreenStackProcessor(): PipelineProcessor {
  return {
    process(ctx: PipelineContext): boolean {
      if (ctx.anyOverlayConsumed) return false;

      const path = ctx.screenPath;
      for (let i = path.length - 1; i >= 0; i--) {
        const comp = path[i];
        const layer = ctx.layersRef.current.get(comp);
        if (!layer) continue;
        const isTop = i === path.length - 1;
        if (handleLayer(
          layer, ctx.eventNames, ctx.input, ctx.key,
          isTop, ctx.notifyFocusChange, ctx.activeCount,
          false, ctx.wildcardFirst,
        )) break;
      }
      return false;
    },
  };
}
