import type { PipelineContext, PipelineProcessor } from '../types.js';
import { checkGlobalKey } from '../check-global-key.js';

/**
 * Create a processor for global single-key bindings.
 *
 * Iterates registered global keys, filters by the given affectOverlay flag,
 * applies executeWhenNoOverlay / override / category / times constraints,
 * and fires the first matching entry.
 *
 * @param config.affectOverlay - Which priority group this processor serves.
 * @returns A PipelineProcessor for the global key stage.
 *
 * @2026-06-14 v3.4.0
 */
export function createGlobalKeyProcessor(config: {
  affectOverlay: boolean;
}): PipelineProcessor {
  const { affectOverlay } = config;
  return {
    process(ctx: PipelineContext): boolean {
      for (const entry of ctx.globalKeys) {
        if ((entry.affectOverlay ?? false) !== affectOverlay) continue;

        if (affectOverlay) {
          if (ctx.activeCount === 0 && !entry.executeWhenNoOverlay) continue;

          let anyOverlayHasOverride = false;
          if (entry.cover !== false) {
            const keyNames = Array.isArray(entry.key) ? entry.key : [entry.key];
            for (const overlay of ctx.activeOverlays) {
              const overlayLayer = ctx.layersRef.current.get(overlay.id);
              if (overlayLayer && keyNames.some(k => overlayLayer.globalKeyOverrides.has(k))) {
                anyOverlayHasOverride = true;
                break;
              }
            }
          }
          if (anyOverlayHasOverride) continue;
        } else {
          let screenHasOverride = false;
          if (entry.cover !== false && ctx.topComponent) {
            const keyNames = Array.isArray(entry.key) ? entry.key : [entry.key];
            const topLayer = ctx.layersRef.current.get(ctx.topComponent);
            if (topLayer && keyNames.some(k => topLayer.globalKeyOverrides.has(k))) {
              screenHasOverride = true;
            }
          }
          if (screenHasOverride) continue;
        }

        if (checkGlobalKey(entry, ctx.eventNames, ctx.topComponent, ctx.layersRef)) {
          if (entry.times !== undefined && entry.times >= 1) {
            entry.pressCount! += 1;
            if (entry.pressCount! < entry.times!) {
              return true;
            }
            entry.pressCount = 0;
          }
          entry.operate();
          return true;
        }
      }
      return false;
    },
  };
}
