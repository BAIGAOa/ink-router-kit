import type React from 'react';
import type { LayerOwner } from './context.js';
import type {
  GlobalKeyEntry,
  ScreenKeyboardLayer,
} from './types.js';

/**
 * Check whether a global key entry should fire for the current event.
 *
 * Evaluates key-name matching, category whitelist, and screen-level
 * global-key override (cover mechanism).
 *
 * @param entry        The global key entry to evaluate.
 * @param eventNames   Normalized key names from the current event.
 * @param topComponent The topmost screen component, or null if no screen is active.
 * @param layersRef    Mutable ref to all keyboard layers.
 * @returns true if the global key matches and is not overridden.
 *
 * @2026-06-14 v3.4.0
 */
export function checkGlobalKey(
  entry: GlobalKeyEntry,
  eventNames: string[],
  topComponent: React.ComponentType<any> | null,
  layersRef: React.MutableRefObject<Map<LayerOwner, ScreenKeyboardLayer>>,
): boolean {
  const keyNames = Array.isArray(entry.key) ? entry.key : [entry.key];
  if (!keyNames.some((k) => eventNames.includes(k))) return false;
  if (!topComponent) return false;

  const cat = entry.category;
  if (cat === undefined || cat === '*') {
  } else if (Array.isArray(cat) && cat.length === 0) {
    return false;
  } else if (Array.isArray(cat)) {
    if (!cat.includes(topComponent)) return false;
  }

  const topLayer = layersRef.current.get(topComponent);

  // Global Key rules (affectOverlay + cover)
  //
  // When an Overlay is active:
  // - [true,  true] : Affects Overlay, can be overridden only by Overlay
  // - [true,  false]: Affects Overlay, cannot be overridden by anyone
  // - [false, true] : Does NOT affect Overlay; works on Screen Stack, can be overridden by Screen Stack
  // - [false, false]: Does NOT affect Overlay; works on Screen Stack, cannot be overridden by Screen Stack
  //
  // When NO Overlay is active (default):
  // - affectOverlay = true  → Key becomes inactive
  // - affectOverlay = false → Key remains active on Screen Stack (override rules as above)
  //
  // Option executeWhenNoOverlay (only if affectOverlay = true):
  // Keeps the key active on Screen Stack even without an Overlay, while preserving the original cover rule.
  // @2026-06-11 v3.3.0
  if (topLayer && !entry.affectOverlay && (entry.cover ?? true)) {
    if (keyNames.some((k) => topLayer.globalKeyOverrides.has(k))) return false;
  }

  return true;
}
