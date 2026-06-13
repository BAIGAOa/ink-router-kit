import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useInput, Key } from 'ink';
import { KeyboardContext, LayerOwner } from './context.js';
import {
  KeyHandler,
  BoundKeyboardOptions,
  BoundKeyEntry,
  ScreenKeyboardLayer,
  GlobalKeyEntry,
  GlobalSequenceEntry,
  BlockedKeyOptions,
  StopOptions,
  ShortcutOperationEntry,
  SequenceOptions,
  SequenceBinding,
  PendingSequence,
} from './types.js';
import { useScreenSystem } from '../screen/hook.js';

const DEFAULT_SEQUENCE_TIMEOUT = 500;

/**
 * Convert an Ink `(input, key)` event into a list of possible key-name
 * strings for matching.
 *
 * For special keys (return, escape, arrows, etc.) it produces the base
 * name plus any modifier-prefixed variants.  For character keys it
 * produces the raw character and modifier combinations.
 *
 * Examples:
 *   press('s', { ctrl: true })  →  ["s", "ctrl+s"]
 *   press('',  { escape: true }) → ["escape"]
 *   press('',  { return: true, shift: true }) → ["return", "shift+return"]
 */
function normalizeKeyNames(input: string, key: Key): string[] {
  const names: string[] = [];

  const specialMap: Array<[keyof Key, string]> = [
    ['return', 'return'],
    ['escape', 'escape'],
    ['backspace', 'backspace'],
    ['delete', 'delete'],
    ['upArrow', 'up'],
    ['downArrow', 'down'],
    ['leftArrow', 'left'],
    ['rightArrow', 'right'],
    ['tab', 'tab'],
    ['pageDown', 'pagedown'],
    ['pageUp', 'pageup'],
    ['home', 'home'],
    ['end', 'end'],
  ];

  for (const [kProp, kName] of specialMap) {
    if (key[kProp]) {
      names.push(kName);
      if (key.ctrl) names.push(`ctrl+${kName}`);
      if (key.shift) names.push(`shift+${kName}`);
      if (key.meta) names.push(`meta+${kName}`);
      if (key.ctrl && key.shift) names.push(`ctrl+shift+${kName}`);
      return names;
    }
  }

  if (input) {
    names.push(input);
    if (key.ctrl) names.push(`ctrl+${input}`);
    if (key.shift) names.push(`shift+${input}`);
    if (key.meta) names.push(`meta+${input}`);
    if (key.ctrl && key.shift) names.push(`ctrl+shift+${input}`);
  }

  return names
}

/**
* Wildcard Checker
* In order to adapt and better integrate TextInput, almost all special keys are excluded.
* This will be used and judged in subsequent useInput
*
* TODO: Finish the implementation of TextInput as soon as possible
*/
function isNormalCharacter(input: string, key: Key): boolean {
  // 必须有实际字符内容
  if (!input) return false;

  //排除所有特殊键（type guard：这些键对应的 Key 属性为 true 时，一律不是普通字符）
  if (key.upArrow) return false;
  if (key.downArrow) return false;
  if (key.leftArrow) return false;
  if (key.rightArrow) return false;

  if (key.pageDown) return false;
  if (key.pageUp) return false;

  if (key.home) return false;
  if (key.end) return false;

  if (key.return) return false;
  if (key.escape) return false;
  if (key.tab) return false;
  if (key.backspace) return false;
  if (key.delete) return false;

  // 排除各类修饰键组合（Ctrl/Meta/Super/Hyper）
  // 根据 Ink 中的Key类型定义源码，Ctrl+字母等组合应走具体键名匹配，不触发通配符
  if (key.ctrl) return false;
  if (key.meta) return false;
  if (key.super) return false;
  if (key.hyper) return false;

  // eventType === 'release' 时忽略（防止重复触发）
  if (key.eventType === 'release') return false;

  // 若以上检查全部通过，我们就可以立刻认定这是一个通配符"*"
  return true;
}

function checkGlobalKey(
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

  
  // In our design expectations,  
  // Only when affectOverlay is false and cover is true in the options of a Global Key can it be overwritten by Screen Stack  
  // The following are the behaviors that result from all combinations:  
  // When affectOverlay: true and cover: true, Screen Stack cannot overwrite, but Overlay Level can. If no Overlay is active, this Global Key will become invalid  
  // When affectOverlay: true and cover: false, neither Screen Stack nor Overlay Level can overwrite this Global Key, but it can still affect Overlay Level. Similarly, when no Overlay is active, this Global Key will also become invalid  
  // When affectOverlay: false and cover: true, this Global Key cannot affect Overlay Level, and naturally Overlay Level cannot overwrite it. However, it still takes effect on Screen Stack, and Screen Stack can overwrite it  
  // When affectOverlay: false and cover: false, this Global Key cannot affect Overlay Level nor be overwritten by Screen Stack  
  //  
  // NOTE: When you enable options.executeWhenNoOverlay and affectOverlay is true (if affectOverlay is not true, enabling executeWhenNoOverlay is meaningless),  
  // this Global Key will also take effect on Screen Stack when no Overlay is active. Please **note**! It does not affect the overwrite mechanism of cover. In this case, Screen Stack still cannot overwrite this Global Key  
  // cover is only affected by affectOverlay
  // @2026-06-14 version 3.3.0
  if (topLayer && !entry.affectOverlay && (entry.cover ?? true)) {
    if (keyNames.some((k) => topLayer.globalKeyOverrides.has(k))) return false;
  }

  return true;
}

/**
 * Iterate through a list of bindings and fire the first matching handler.
 *
 * Matches exact key names first, then falls back to the wildcard `"*"` binding
 * for normal character input (see {@link isNormalCharacter}).
 *
 * @param bindings      Ordered list of key bindings to try.
 * @param unblockedKeys Normalized key names not blocked at this layer.
 * @param input         Raw character from Ink's useInput.
 * @param key           Full Key descriptor from Ink.
 * @param skipBinding   Optional predicate to skip individual bindings
 *                      (used for `onlyThis` enforcement).
 * @returns `true` if a binding matched and consumed the event.
 */
function tryMatchBindings(
  bindings: BoundKeyEntry[],
  unblockedKeys: string[],
  input: string,
  key: Key,
  skipBinding?: (binding: BoundKeyEntry) => boolean,
): boolean {
  if (unblockedKeys.length === 0) return false;

  for (const binding of bindings) {
    if (skipBinding && skipBinding(binding)) continue;
    if (binding.keys.some((k) => unblockedKeys.includes(k))) {
      binding.handler(input, key);
      return true;
    }
  }

  const wildcardBinding = bindings.find(b => b.keys.includes('*'));
  if (wildcardBinding && isNormalCharacter(input, key)) {
    if (!skipBinding || !skipBinding(wildcardBinding)) {
      wildcardBinding.handler(input, key);
      return true;
    }
  }

  return false;
}

/**
 * Built-in Tab / Shift+Tab focus rotation for a given layer.
 *
 * Cycles {@link ScreenKeyboardLayer.currentFocusId} through the layer's
 * {@link ScreenKeyboardLayer.focusOrder} list (Tab forward, Shift+Tab backward).
 * Wraps around at both ends.
 *
 * @returns `true` if a tab event was handled and focus was moved.
 */
function handleTabNavigation(
  layer: ScreenKeyboardLayer,
  eventNames: string[],
  shift: boolean,
  notifyFocusChange: () => void,
): boolean {
  if (!eventNames.includes('tab') || layer.focusOrder.length === 0) return false;
  const current = layer.currentFocusId;
  let idx = current ? layer.focusOrder.indexOf(current) : -1;
  if (shift) {
    idx = idx <= 0 ? layer.focusOrder.length - 1 : idx - 1;
  } else {
    idx = (idx + 1) % layer.focusOrder.length;
  }
  layer.currentFocusId = layer.focusOrder[idx];
  notifyFocusChange();
  return true;
}

/**
 * Handle a keyboard event against a single layer.
 *
 * Evaluates tab navigation, blocked keys, focus-target bindings,
 * layer-level bindings, and stopped keys — in that order.
 *
 * @returns true if the event was consumed by this layer.
 */
function handleLayer(
  layer: ScreenKeyboardLayer,
  eventNames: string[],
  input: string,
  key: Key,
  isTop: boolean,
  notifyFocusChange: () => void,
  activeOverlayCount: number,
  isOverlay: boolean,
  wildcardFirst: boolean,
): boolean {
  if (isTop && handleTabNavigation(layer, eventNames, key.shift, notifyFocusChange)) return true;

  const blocked = layer.blockedKeys;
  const unblocked = eventNames.filter((n) => !blocked.includes(n));

  // onlyThis semantics differ between screens and overlays:
  // - Screen: skip when any overlay is active (activeOverlayCount > 0)
  // - Overlay: skip only when multiple overlays compete (activeOverlayCount > 1)
  const shouldSkipOnlyThis = (b: BoundKeyEntry): boolean => {
    if (!b.onlyThis) return false;
    if (isOverlay) return activeOverlayCount > 1;
    return activeOverlayCount > 0;
  };

  // Wildcard priority pre-check: when enabled, wildcard `*` bindings
  // are evaluated before sequences, exact matches, and everything else.
  // Only normal characters are affected — special keys fall through.
  if (isTop && wildcardFirst && unblocked.length > 0) {
    // Check focus-target wildcard first
    if (layer.currentFocusId) {
      const ft = layer.focusTargets.get(layer.currentFocusId);
      if (ft) {
        const fBlocked = ft.blockedKeys;
        const fUnblocked = unblocked.filter(n => !fBlocked.includes(n));
        if (fUnblocked.length > 0) {
          const wb = ft.bindings.find(b => b.keys.includes('*'));
          if (wb && isNormalCharacter(input, key)) {
            if (!shouldSkipOnlyThis(wb)) {
              wb.handler(input, key);
              return true;
            }
          }
        }
      }
    }
    // Check screen-level wildcard
    const wb = layer.bindings.find(b => b.keys.includes('*'));
    if (wb && isNormalCharacter(input, key)) {
      if (!shouldSkipOnlyThis(wb)) {
        wb.handler(input, key);
        return true;
      }
    }
  }

  // Sequence matching: only for the top layer (isTop).
  // Sequences have priority over ordinary boundKeyboard bindings.
  if (isTop && unblocked.length > 0) {
    const pending = layer.pendingSequence;

    // We already have a pending sequence in progress.
    if (pending !== null) {
      const expectedKey = pending.sequences[pending.nextIndex];
      if (unblocked.includes(expectedKey)) {
        // Matched the next key in the sequence.
        clearTimeout(pending.timer);
        pending.nextIndex++;
        if (pending.nextIndex === pending.sequences.length) {
          // Full sequence matched — fire handler.
          pending.handler(input, key);
          layer.pendingSequence = null;
        } else {
          // Still waiting for more keys — restart the timeout.
          pending.timer = setTimeout(() => {
            if (layer.pendingSequence === pending) layer.pendingSequence = null;
          }, pending.timeout);
        }
        return true;
      } else {
        // Mismatch.
        if (pending.options?.exclusive === true) {
          // Exclusive mode: ignore the key, keep waiting.
          return true;
        } else {
          // Non-exclusive (default): cancel the sequence and let the key
          // fall through to normal bindings.
          clearTimeout(pending.timer);
          layer.pendingSequence = null;
        }
      }
    }

    // No pending sequence — try to start a new one from the first unblocked key.
    if (layer.pendingSequence === null) {
      // Check each unblocked key name (not just the first) to handle
      // modifier combinations like 'ctrl+w' which appear after 'w'.
      for (const keyName of unblocked) {
        const candidates = layer.sequences.get(keyName);
        if (!candidates || candidates.length === 0) continue;
        // Filter by onlyThis and focusId constraints.
        const selected = candidates.find(binding => {
          if (binding.options?.onlyThis) {
            if (isOverlay) return activeOverlayCount <= 1;
            else return activeOverlayCount === 0;
          }
          if (binding.options?.focusId) {
            return layer.currentFocusId === binding.options.focusId;
          }
          return true;
        });
        if (selected) {
          const timeout = selected.timeout ?? DEFAULT_SEQUENCE_TIMEOUT;
          const newSeq: PendingSequence = {
            sequences: selected.keys,
            nextIndex: 1,
            handler: selected.handler,
            timer: undefined as unknown as NodeJS.Timeout,
            timeout,
            options: selected.options,
          };
          const timer = setTimeout(() => {
            if (layer.pendingSequence === newSeq) layer.pendingSequence = null;
          }, timeout);
          newSeq.timer = timer;
          layer.pendingSequence = newSeq;
          return true;
        }
      }
    }
  }

  if (isTop && layer.currentFocusId) {
    const ft = layer.focusTargets.get(layer.currentFocusId);
    if (ft) {
      const fBlocked = ft.blockedKeys;
      const fUnblocked = unblocked.filter((n) => !fBlocked.includes(n));

      if (tryMatchBindings(ft.bindings, fUnblocked, input, key, shouldSkipOnlyThis)) return true;

      if (eventNames.some((n) => ft.stoppedKeys.includes(n))) {
        return true;
      }
    }
  }

  if (tryMatchBindings(layer.bindings, unblocked, input, key, shouldSkipOnlyThis)) return true;

  if (isTop && eventNames.some((n) => layer.stoppedKeys.includes(n))) {
    return true;
  }

  return false;
}

/**
 * Remove keys from {@link ScreenKeyboardLayer.globalKeyOverrides} when no
 * bindings (screen-level or focus-target) still reference them.
 * Keeps the override set consistent after unbind operations.
 */
function cleanupGlobalKeyOverrides(
  layer: ScreenKeyboardLayer,
  keys: string[],
): void {
  for (const k of keys) {
    const stillBound =
      layer.bindings.some(b => b.keys.includes(k)) ||
      [...layer.focusTargets.values()].some(ft =>
        ft.bindings.some(b => b.keys.includes(k))
      );
    if (!stillBound) {
      layer.globalKeyOverrides.delete(k);
    }
  }
}

/**
 * Remove specific keys from an action's entry in the actionKeysMap.
 * If no keys remain for the action after removal, the entire entry is deleted.
 *
 * Used during unbind to keep the map consistent with the current bindings.
 */
function removeKeysFromActionMap(
  map: Map<string, string[]>,
  actionId: string,
  keysToRemove: string[],
) {
  const arr = map.get(actionId);
  if (!arr) return;
  const filtered = arr.filter(k => !keysToRemove.includes(k));
  if (filtered.length === 0) {
    map.delete(actionId);
  } else {
    map.set(actionId, filtered);
  }
}

/**
 * Clear all registered shortcut operations.
 *
 * NOTE: Since the refactoring to per-instance useRef state, this function
 * is a no-op at module level. Shortcut operations are now scoped to each
 * {@link KeyboardProvider} instance and are automatically cleaned up when
 * the provider unmounts.
 *
 * Kept for backward compatibility with tests and external consumers that
 * call this function in cleanup routines.
 */
export function clearShortcutOperations(): void {
  // No-op: state is now per-instance via useRef inside KeyboardProvider
}

export interface KeyboardProviderProps {
  children: ReactNode;
}

/**
 * Keyboard context provider for layered key handling.
 *
 * Manages per-screen-layer key bindings, transparent keys (`blockedKey`),
 * key-stop propagation barriers (`stop`), and global keys (`globalKeys`).
 * Handles the full event priority chain:
 *   1. Global keys with `affectOverlay: true`
 *   2. Broadcast to all active overlays (sorted by zIndex ascending)
 *   3. Global keys with `affectOverlay: false` (default)
 *   4. Screen stack (top → bottom), only if no overlay consumed the event
 *   5. Drop unhandled keys
 *
 * Must be nested inside a {@link ScenarioManagementProvider} so that the
 * current screen path and overlay state are available.
 */
export function KeyboardProvider({ children }: KeyboardProviderProps) {
  const {
    currentPath,
    activeOverlayIds,
    displayedOverlays,
  } = useScreenSystem();

  // 使用 useRef 替代模块级全局变量，实现多实例隔离
  const pathRef = useRef<React.ComponentType<any>[]>(currentPath);
  const activeOverlayIdsRef = useRef<Set<string>>(new Set());
  const displayedOverlaysRef = useRef(displayedOverlays);

  const globalKeysRef = useRef<{
    key: string | string[];
    operate: () => void;
    cover?: boolean;
    affectOverlay?: boolean;
    category?: React.ComponentType<any>[] | "*";
    times?: number;
    pressCount?: number;
    executeWhenNoOverlay?: boolean
  }[]>([]);
  const focusSubscribersRef = useRef(new Set<() => void>());
  const wildcardPriorityCountRef = useRef<number>(0);

  // Global sequence state: registered entries and current pending state.
  const globalSequencesRef = useRef<GlobalSequenceEntry[]>([]);
  const globalPendingSeqRef = useRef<{
    sequences: string[];
    nextIndex: number;
    handler: () => void;
    timer: NodeJS.Timeout;
    timeout: number;
    exclusive: boolean;
    affectOverlay: boolean;
    cover: boolean;
    category?: React.ComponentType<any>[] | "*";
    executeWhenNoOverlay?: boolean;
  } | null>(null);

  const shortcutOperationsRef = useRef(
    new Map<string, { action: () => void; keys?: string[] }>()
  );

  // Owner stack: top of stack is the current "owner" for keyboard bindings.
  // When inside an overlay, the overlay ID is pushed. When outside, the
  // top component from the screen path is used as fallback.
  const ownerStackRef = useRef<LayerOwner[]>([]);

  // 每次渲染同步最新值（无副作用，只是指针赋值）
  pathRef.current = currentPath;
  activeOverlayIdsRef.current = new Set(activeOverlayIds);
  displayedOverlaysRef.current = displayedOverlays;

  // layersRef now accepts both component types (for screens) and strings (for overlay IDs)
  const layersRef = useRef<Map<LayerOwner, ScreenKeyboardLayer>>(new Map());

  const prevPathRef = useRef<React.ComponentType<any>[]>([]);

  // Clean up layers for removed screens
  useEffect(() => {
    const prev = prevPathRef.current;
    for (const comp of prev) {
      if (!currentPath.includes(comp)) {
        const layer = layersRef.current.get(comp);
        if (layer?.pendingSequence) {
          clearTimeout(layer.pendingSequence.timer);
          layer.pendingSequence = null;
        }
        layersRef.current.delete(comp);
      }
    }
    prevPathRef.current = currentPath;
  }, [currentPath]);

  // Clean up layers for removed overlays
  const prevOverlayIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentIds = new Set(displayedOverlays.map(o => o.id));

    // Delete layers for overlays that no longer exist
    for (const key of layersRef.current.keys()) {
      if (typeof key === 'string' && !currentIds.has(key)) {
        const layer = layersRef.current.get(key);
        if (layer?.pendingSequence) {
          clearTimeout(layer.pendingSequence.timer);
          layer.pendingSequence = null;
        }
        layersRef.current.delete(key);
      }
    }

    prevOverlayIdsRef.current = currentIds;
  }, [displayedOverlays]);

  // ---- Owner stack management (internal, used by useKeyboard) ----

  const pushOwner = useCallback((owner: LayerOwner) => {
    ownerStackRef.current = [...ownerStackRef.current, owner];
  }, []);

  const popOwner = useCallback((owner: LayerOwner) => {
    ownerStackRef.current = ownerStackRef.current.filter(o => o !== owner);
  }, []);

  const enableWildcardPriority = useCallback(() => {
    wildcardPriorityCountRef.current += 1;
    let disabled = false;
    return () => {
      if (disabled) return;
      disabled = true;
      wildcardPriorityCountRef.current = Math.max(0, wildcardPriorityCountRef.current - 1);
    };
  }, []);

  // ---- Core keyboard functions ----

  const getLayer = useCallback(
    (owner: LayerOwner) => {
      let layer = layersRef.current.get(owner);
      if (!layer) {
        layer = {
          bindings: [],
          blockedKeys: [],
          stoppedKeys: [],
          globalKeyOverrides: new Set(),
          focusTargets: new Map(),
          focusOrder: [],
          currentFocusId: null,
          actionKeysMap: new Map(),
          sequences: new Map(),
          pendingSequence: null,
        };
        layersRef.current.set(owner, layer);
      }
      return layer;
    },
    [],
  );

  const getCurrentOwner = useCallback((): LayerOwner | null => {
    const stack = ownerStackRef.current;
    if (stack.length > 0) return stack[stack.length - 1];
    const path = pathRef.current;
    if (path.length === 0) return null;
    return path[path.length - 1];
  }, []);

  const notifyFocusChange = useCallback(() => {
    focusSubscribersRef.current.forEach(fn => fn());
  }, []);

  /**
   * Clear the pending sequence timer on a layer, if one is active.
   * Does nothing if the layer has no pending sequence.
   */
  const clearPendingSequence = useCallback((layer: ScreenKeyboardLayer) => {
    if (layer.pendingSequence !== null) {
      clearTimeout(layer.pendingSequence.timer);
      layer.pendingSequence = null;
    }
  }, []);

  const getOrCreateFocusTarget = useCallback(
    (layer: ScreenKeyboardLayer, focusId: string) => {
      let target = layer.focusTargets.get(focusId);
      if (!target) {
        target = {
          bindings: [],
          blockedKeys: [],
          stoppedKeys: [],
          actionKeysMap: new Map(),
        };
        layer.focusTargets.set(focusId, target);
        layer.focusOrder.push(focusId);
        if (layer.currentFocusId === null) {
          layer.currentFocusId = focusId;
          notifyFocusChange();
        }
      }
      return target;
    },
    [notifyFocusChange],
  );

  /**
   * Bind keys on the current layer (screen or overlay).
   *
   * The owner is automatically determined from the owner stack
   * (set by OverlayContext when inside an overlay) or falls back
   * to the top screen component.
   *
   * Overloads:
   * 1. (keys: string[], handler: KeyHandler | string, options?: BoundKeyboardOptions)
   * 2. (actionId: string, options: BoundKeyboardOptions) -> uses the action's predefined keys
   */
  const boundKeyboard = useCallback(
    (
      keysOrActionId: string | string[],
      handlerOrOptions: KeyHandler | string | BoundKeyboardOptions,
      maybeOptions?: BoundKeyboardOptions,
    ): (() => void) => {

      function createBoundKeyEntry(
        keys: string[],
        handler: KeyHandler | string,
        onlyThis: boolean,
        owner: LayerOwner,
      ): BoundKeyEntry {
        if (typeof handler === 'string') {
          const entry = shortcutOperationsRef.current.get(handler);
          if (!entry) {
            throw new Error(
              `[Ink-Router-Kit] The shortcut key you used does not exist with ID ${handler}`,
            );
          }
          return { keys, handler: entry.action, onlyThis, owner };
        }
        return { keys, handler, onlyThis, owner };
      }

      function applyGlobalKeyOverrides(
        keys: string[],
        owner: LayerOwner,
        layer: ScreenKeyboardLayer,
        bindingContext: string,
      ): void {
        for (const gk of globalKeysRef.current) {
          const gkKeys = Array.isArray(gk.key) ? gk.key : [gk.key];
          const matchingKeys = gkKeys.filter((k) => keys.includes(k));
          if (matchingKeys.length === 0) continue;

          const isOverlayOwner = typeof owner === 'string';
          const cat = gk.category;
          let inCategory = false;

          // Category applies to screen components, not overlay IDs
          if (!isOverlayOwner) {
            if (cat === undefined || cat === '*') {
              inCategory = true;
            } else if (Array.isArray(cat)) {
              inCategory = cat.includes(owner);
            }
            if (!inCategory) continue;
          }

          const cover = gk.cover ?? true;
          const affectOverlay = gk.affectOverlay ?? false;

          if (isOverlayOwner) {
            // Overlay owners can only override global keys that target overlays
            // (affectOverlay: true). Non-affectOverlay global keys fire after
            // overlays in step 3, so overlays don't need to override them.
            if (!affectOverlay) continue;
            if (!cover) {
              throw new Error(
                `[Ink-Router-Kit] Overlay "${owner}" ` +
                `attempted to bind "${matchingKeys[0]}" via ${bindingContext}, ` +
                `but this key is already declared in globalKeys with cover: false, so overriding is not allowed.`,
              );
            }
          } else {
            // Screen owners cannot override global keys that target overlays.
            // Only overlays themselves can override those (the check above).
            if (affectOverlay) continue;
            if (!cover) {
              const ownerName = owner.displayName || owner.name || 'anonymous';
              throw new Error(
                `[Ink-Router-Kit] Component "${ownerName}" ` +
                `attempted to bind "${matchingKeys[0]}" via ${bindingContext}, ` +
                `but this key is already declared in globalKeys with cover: false, so overriding is not allowed.`,
              );
            }
          }

          for (const k of matchingKeys) {
            layer.globalKeyOverrides.add(k);
          }
        }
      }

      // 重载解析：快捷操作模式
      if (typeof keysOrActionId === 'string' && typeof handlerOrOptions !== 'function' && typeof handlerOrOptions !== 'string') {
        const actionId = keysOrActionId;
        const options = handlerOrOptions as BoundKeyboardOptions;
        const entry = shortcutOperationsRef.current.get(actionId);
        if (!entry) {
          throw new Error(`[Ink-Router-Kit] Action "${actionId}" is not registered.`);
        }
        if (!entry.keys || entry.keys.length === 0) {
          throw new Error(
            `[Ink-Router-Kit] Action "${actionId}" does not have predefined keys. Please register with keys field or call boundKeyboard with explicit keys.`,
          );
        }
        return boundKeyboard(entry.keys, actionId, options);
      }

      // 原有调用方式
      const keys = keysOrActionId as string[];
      const handler = handlerOrOptions as KeyHandler | string;
      const options = maybeOptions;

      const owner = getCurrentOwner();
      if (!owner) {
        throw new Error(
          '[Ink-Router-Kit] boundKeyboard() must be called inside a screen component or overlay. There is currently no active screen.',
        );
      }

      // 校验 times 参数
      if (options?.times !== undefined && options.times < 1) {
        throw new Error(
          '[Ink-Router-Kit] boundKeyboard() times option must be >= 1.',
        );
      }

      const layer = getLayer(owner);

      if (options?.focusId) {
        const fid = options.focusId;
        const target = getOrCreateFocusTarget(layer, fid);

        applyGlobalKeyOverrides(keys, owner, layer, `focusId="${fid}"`);

        const entry = createBoundKeyEntry(keys, handler, options?.onlyThis ?? false, owner);

        target.bindings.push(entry);

        // 如果 handler 是字符串（actionId），将 keys 注册到 focus target 的 actionKeysMap
        if (typeof handler === 'string') {
          const existing = target.actionKeysMap.get(handler) || [];
          for (const k of keys) {
            if (!existing.includes(k)) existing.push(k);
          }
          target.actionKeysMap.set(handler, existing);
        }

        const doUnbind = () => {
          const idx = target!.bindings.indexOf(entry);
          if (idx !== -1) target!.bindings.splice(idx, 1);
          cleanupGlobalKeyOverrides(layer, entry.keys);
          if (typeof handler === 'string') {
            removeKeysFromActionMap(target!.actionKeysMap, handler, keys);
          }
        };

        // Apply times and/or once wrappers
        if (options?.times !== undefined && options.times >= 1) {
          entry.times = options.times;
          entry.pressCount = 0;
          const originalHandler = entry.handler;
          entry.handler = (input: string, key: Key) => {
            entry.pressCount! += 1;
            if (entry.pressCount! < entry.times!) {
              return;
            }
            entry.pressCount = 0;
            if (options?.once) {
              doUnbind();
            }
            originalHandler(input, key);
          };
        } else if (options?.once) {
          const originalHandler = entry.handler;
          entry.handler = (input: string, key: Key) => {
            doUnbind();
            originalHandler(input, key);
          };
        }

        return doUnbind;
      }

      applyGlobalKeyOverrides(keys, owner, layer, 'boundKeyboard');

      const entry = createBoundKeyEntry(keys, handler, options?.onlyThis ?? false, owner);

      layer.bindings.push(entry);

      // 如果 handler 是字符串（actionId），将 keys 注册到 layer 的 actionKeysMap
      if (typeof handler === 'string') {
        const existing = layer.actionKeysMap.get(handler) || [];
        for (const k of keys) {
          if (!existing.includes(k)) existing.push(k);
        }
        layer.actionKeysMap.set(handler, existing);
      }

      const doUnbind = () => {
        const idx = layer.bindings.indexOf(entry);
        if (idx !== -1) layer.bindings.splice(idx, 1);
        cleanupGlobalKeyOverrides(layer, entry.keys);
        if (typeof handler === 'string') {
          removeKeysFromActionMap(layer.actionKeysMap, handler, keys);
        }
      };

      // Apply times and/or once wrappers
      if (options?.times !== undefined && options.times >= 1) {
        entry.times = options.times;
        entry.pressCount = 0;
        const originalHandler = entry.handler;
        entry.handler = (input: string, key: Key) => {
          entry.pressCount! += 1;
          if (entry.pressCount! < entry.times!) {
            return;
          }
          entry.pressCount = 0;
          if (options?.once) {
            doUnbind();
          }
          originalHandler(input, key);
        };
      } else if (options?.once) {
        const originalHandler = entry.handler;
        entry.handler = (input: string, key: Key) => {
          doUnbind();
          originalHandler(input, key);
        };
      }

      return doUnbind;
    },
    [getCurrentOwner, getLayer, getOrCreateFocusTarget],
  );

  /**
   * Mark keys as transparent on the current layer.
   */
  const penetration = useCallback(
    (keys: string[], options?: BlockedKeyOptions): (() => void) => {
      const owner = getCurrentOwner();
      if (!owner) {
        throw new Error('[Ink-Router-Kit] blockedKey() must be called inside a screen component or overlay.');
      }
      const layer = getLayer(owner);

      if (options?.focusId) {
        const target = getOrCreateFocusTarget(layer, options.focusId);
        const added: string[] = [];
        for (const k of keys) {
          if (!target.blockedKeys.includes(k)) {
            target.blockedKeys.push(k);
            added.push(k);
          }
        }
        return () => {
          for (const k of added) {
            const idx = target.blockedKeys.indexOf(k);
            if (idx !== -1) target.blockedKeys.splice(idx, 1);
          }
        };
      }

      const added: string[] = [];
      for (const k of keys) {
        if (!layer.blockedKeys.includes(k)) {
          layer.blockedKeys.push(k);
          added.push(k);
        }
      }
      return () => {
        for (const k of added) {
          const idx = layer.blockedKeys.indexOf(k);
          if (idx !== -1) layer.blockedKeys.splice(idx, 1);
        }
      };
    },
    [getCurrentOwner, getLayer, getOrCreateFocusTarget],
  );

  /**
   * Prevent keys from propagating beyond the current layer.
   */
  const stop = useCallback(
    (keys: string[], options?: StopOptions): (() => void) => {
      const owner = getCurrentOwner();
      if (!owner) {
        throw new Error('[Ink-Router-Kit] stop() must be called inside a screen component or overlay.');
      }
      const layer = getLayer(owner);

      // 如果启用 stopAction 模式，则将传入的 action ID 转换为对应的键名
      let effectiveKeys: string[] = keys;
      if (options?.stopAction) {
        const map = options.focusId
          ? getOrCreateFocusTarget(layer, options.focusId).actionKeysMap
          : layer.actionKeysMap;
        const merged: string[] = [];
        const ownerName = typeof owner === 'string' ? owner : ((owner as any).displayName || owner.name || 'Unknown');
        for (const actionId of keys) {
          const boundKeys = map.get(actionId);
          if (!boundKeys) {
            throw new Error(
              `[Ink-Router-Kit] stop(["${actionId}"], { stopAction: true }) on "${ownerName}": ` +
              `action "${actionId}" is not registered or has no keys bound. ` +
              `Register it with defineShortcutAction() and bind it with boundKeyboard() first.`,
            );
          }
          for (const k of boundKeys) {
            if (!merged.includes(k)) merged.push(k);
          }
        }
        effectiveKeys = merged;
      }

      if (options?.focusId) {
        const target = getOrCreateFocusTarget(layer, options.focusId);
        const added: string[] = [];
        for (const k of effectiveKeys) {
          if (!target.stoppedKeys.includes(k)) {
            target.stoppedKeys.push(k);
            added.push(k);
          }
        }
        return () => {
          for (const k of added) {
            const idx = target!.stoppedKeys.indexOf(k);
            if (idx !== -1) target!.stoppedKeys.splice(idx, 1);
          }
        };
      } else {
        const added: string[] = [];
        for (const k of effectiveKeys) {
          if (!layer.stoppedKeys.includes(k)) {
            layer.stoppedKeys.push(k);
            added.push(k);
          }
        }
        return () => {
          for (const k of added) {
            const idx = layer.stoppedKeys.indexOf(k);
            if (idx !== -1) layer.stoppedKeys.splice(idx, 1);
          }
        };
      }
    },
    [getCurrentOwner, getLayer, getOrCreateFocusTarget],
  );

  /**
   * Register a multi-key sequence binding.
   *
   * When a sequence's first key is pressed, the layer enters a pending
   * state waiting for subsequent keys.  If the full sequence is entered
   * within the timeout, the handler fires.  Otherwise the sequence is
   * cancelled.
   *
   * @param keys      The ordered key names that make up the sequence
   *                  (e.g. `['g', 'g']`, `['c', 'w']`). Must have length ≥ 2.
   * @param handler   Callback to invoke when the full sequence is matched.
   * @param options   Optional: `timeout` (ms, default 500), `onlyThis`,
   *                  `focusId`, `exclusive` (default false).
   * @returns         An unbind function that removes the sequence binding.
   */
  const boundSequence = useCallback(
    (
      keys: string[],
      handler: KeyHandler,
      options?: SequenceOptions,
    ): (() => void) => {
      const owner = getCurrentOwner();
      if (!owner) {
        throw new Error(
          '[Ink-Router-Kit] boundSequence() must be called inside a screen component or overlay.',
        );
      }
      if (keys.length < 2) {
        throw new Error(
          '[Ink-Router-Kit] boundSequence() requires at least 2 keys in the sequence.'
        )
      }

      // Check global sequence cover constraints. Only boundSequence can
      // override a global sequence; when cover: false, attempting to
      // bind a sequence whose first key matches a global sequence with
      // the same first key is forbidden.
      //
      // Screen owners: checked against all global sequences in their
      // category. Overlay owners: only checked against affectOverlay:true
      // global sequences (affectOverlay:false global sequences fire after
      // overlays, so overlays don't need to override them).
      // @2026-06-13 v3.2.0
      const isOverlayOwner = typeof owner === 'string';
      const firstKey = keys[0];
      for (const gs of globalSequencesRef.current) {
        if (gs.cover !== false) continue;
        if (gs.keys[0] !== firstKey) continue;
        if (isOverlayOwner) {
          // Overlay owners can only override affectOverlay:true global sequences.
          if (!(gs.affectOverlay ?? false)) continue;
        } else {
          // Screen owners: category check.
          const cat = gs.category;
          if (cat !== undefined && cat !== '*') {
            if (Array.isArray(cat) && !cat.includes(owner)) continue;
          }
        }
        const ownerName = isOverlayOwner ? owner : (owner.displayName || owner.name || 'anonymous');
        throw new Error(
          `[Ink-Router-Kit] ${isOverlayOwner ? `Overlay "${ownerName}"` : `Component "${ownerName}"`} ` +
          `attempted to bind sequence [${keys.join(', ')}] via boundSequence, ` +
          `but the first key "${firstKey}" is already declared in globalSequence ` +
          `with cover: false, so overriding is not allowed.`,
        );
      }

      const layer = getLayer(owner);

      const binding: SequenceBinding = {
        keys,
        handler,
        timeout: options?.timeout,
        options,
      };

      const existing = layer.sequences.get(firstKey) || [];
      existing.push(binding);
      layer.sequences.set(firstKey, existing);

      return () => {
        const arr = layer.sequences.get(firstKey);
        if (arr) {
          const idx = arr.indexOf(binding);
          if (idx !== -1) arr.splice(idx, 1);
          if (arr.length === 0) layer.sequences.delete(firstKey);
        }
      };
    },
    [getCurrentOwner, getLayer],
  );

  const subscribeFocus = useCallback((listener: () => void) => {
    focusSubscribersRef.current.add(listener);
    return () => { focusSubscribersRef.current.delete(listener); };
  }, []);

  const focusSet = useCallback(
    (focusId: string) => {
      const owner = getCurrentOwner();
      if (!owner) return;
      const ownerName = typeof owner === 'string' ? owner : ((owner as any).displayName || owner.name || 'Unknown');
      const layer = layersRef.current.get(owner);
      if (!layer) {
        throw new Error(
          `focusSet("${focusId}"): no keyboard layer found for "${ownerName}". ` +
          `Did you forget to wrap the screen in <KeyboardProvider>?`,
        );
      }
      clearPendingSequence(layer);
      if (!layer.focusTargets.has(focusId)) {
        const available = layer.focusOrder.length > 0
          ? layer.focusOrder.map(id => `"${id}"`).join(', ')
          : '(none)';
        throw new Error(
          `focusSet("${focusId}"): focus target not found on "${ownerName}". ` +
          `Available targets: ${available}`,
        );
      }
      if (layer.currentFocusId !== focusId) {
        layer.currentFocusId = focusId;
        notifyFocusChange();
      }
    },
    [getCurrentOwner, notifyFocusChange, clearPendingSequence],
  );

  const focusNext = useCallback(() => {
    const owner = getCurrentOwner();
    if (!owner) return;
    const layer = layersRef.current.get(owner);
    if (!layer || layer.focusOrder.length === 0) return;

    clearPendingSequence(layer);

    const current = layer.currentFocusId;
    let idx = current ? layer.focusOrder.indexOf(current) : -1;
    idx = (idx + 1) % layer.focusOrder.length;
    layer.currentFocusId = layer.focusOrder[idx];
    notifyFocusChange();
  }, [getCurrentOwner, notifyFocusChange, clearPendingSequence]);

  const focusPrev = useCallback(() => {
    const owner = getCurrentOwner();
    if (!owner) return;
    const layer = layersRef.current.get(owner);
    if (!layer || layer.focusOrder.length === 0) return;

    clearPendingSequence(layer);

    const current = layer.currentFocusId;
    let idx = current ? layer.focusOrder.indexOf(current) : -1;
    idx = idx <= 0 ? layer.focusOrder.length - 1 : idx - 1;
    layer.currentFocusId = layer.focusOrder[idx];
    notifyFocusChange();
  }, [getCurrentOwner, notifyFocusChange, clearPendingSequence]);

  const focusCurrent = useCallback((): string | null => {
    const owner = getCurrentOwner();
    if (!owner) return null;
    const layer = layersRef.current.get(owner);
    return layer?.currentFocusId ?? null;
  }, [getCurrentOwner]);

  const focusUnregister = useCallback((focusId: string) => {
    const owner = getCurrentOwner();
    if (!owner) return;
    const layer = layersRef.current.get(owner);
    if (!layer) return;

    const wasFocused = layer.currentFocusId === focusId;
    layer.focusTargets.delete(focusId);
    layer.focusOrder = layer.focusOrder.filter(id => id !== focusId);

    if (wasFocused) {
      layer.currentFocusId =
        layer.focusOrder.length > 0 ? layer.focusOrder[0] : null;
      notifyFocusChange();
    }
  }, [getCurrentOwner, notifyFocusChange]);

  /**
   * Register global key bindings.
   */
  const globalKeys = useCallback(
    (entries: GlobalKeyEntry[], options?: { mode?: 'replace' | 'add' }) => {
      const processed = entries.map((each) => {
        if (each.times !== undefined && each.times < 1) {
          throw new Error(
            '[Ink-Router-Kit] globalKeys() times option must be >= 1.',
          );
        }
        if (typeof each.operate === 'string') {
          const entry = shortcutOperationsRef.current.get(each.operate);
          if (!entry) {
            throw new Error(`[Ink-Kit-Router]You want to call the shortcut ${each.operate} in the global key, but it is not registered`);
          }
          return {
            key: each.key,
            operate: entry.action,
            cover: each.cover,
            category: each.category,
            affectOverlay: each.affectOverlay,
            times: each.times,
            pressCount: each.times !== undefined ? 0 : undefined,
            executeWhenNoOverlay: each.executeWhenNoOverlay
          };
        }
        return {
          key: each.key,
          operate: each.operate,
          cover: each.cover,
          category: each.category,
          affectOverlay: each.affectOverlay,
          times: each.times,
          pressCount: each.times !== undefined ? 0 : undefined,
          executeWhenNoOverlay: each.executeWhenNoOverlay
        };
      });

      if (options?.mode === 'add') {
        globalKeysRef.current = [...globalKeysRef.current, ...processed];
      } else {
        globalKeysRef.current = processed;
      }
    },
    [],
  );

  /**
   * Register global sequence key bindings.
   *
   * Validates each entry (keys length ≥ 2), clears any active global pending
   * sequence on replace, and stores entries for evaluation in the useInput
   * event chain.
   */
  const globalSequence = useCallback(
    (entries: GlobalSequenceEntry[], options?: { mode?: 'replace' | 'add' }) => {
      for (const entry of entries) {
        if (entry.keys.length < 2) {
          throw new Error(
            '[Ink-Router-Kit] globalSequence() requires at least 2 keys per sequence.',
          );
        }
      }

      if (options?.mode === 'add') {
        globalSequencesRef.current = [...globalSequencesRef.current, ...entries];
      } else {
        // Clear any active pending sequence when replacing all entries.
        if (globalPendingSeqRef.current) {
          clearTimeout(globalPendingSeqRef.current.timer);
          globalPendingSeqRef.current = null;
        }
        globalSequencesRef.current = entries;
      }
    },
    [],
  );

  const defineShortcutAction = useCallback((entries: ShortcutOperationEntry[]) => {
    for (const each of entries) {
      if (shortcutOperationsRef.current.has(each.actionId)) {
        throw new Error(`[Ink-Router-Kit]Duplicate shortcut cannot be defined with ID ${each.actionId}`)
      }
      shortcutOperationsRef.current.set(each.actionId, {
        action: each.action,
        keys: each.keys,
      })
    }
  }, [])

  const modifyAction = useCallback((actionId: string, keys: string[]) => {
    const entry = shortcutOperationsRef.current.get(actionId);
    if (!entry) {
      throw new Error(`[Ink-Router-Kit] Cannot modify action "${actionId}": action not registered.`);
    }
    if (entry.keys === undefined) {
      throw new Error(`[Ink-Router-Kit] Cannot modify action "${actionId}": action was not registered with a 'keys' field.`);
    }
    entry.keys = keys;
  }, []);

  const addAction = useCallback((entry: ShortcutOperationEntry) => {
    if (shortcutOperationsRef.current.has(entry.actionId)) {
      throw new Error(`[Ink-Router-Kit] Duplicate shortcut cannot be defined with ID ${entry.actionId}`);
    }
    shortcutOperationsRef.current.set(entry.actionId, {
      action: entry.action,
      keys: entry.keys,
    });
  }, []);

  const hasAction = useCallback((actionId: string): boolean => {
    return shortcutOperationsRef.current.has(actionId);
  }, []);

  const removeAction = useCallback((actionId: string) => {
    if (!shortcutOperationsRef.current.has(actionId)) {
      throw new Error(`[Ink-Router-Kit] Cannot remove action "${actionId}": action not registered.`);
    }
    shortcutOperationsRef.current.delete(actionId);
  }, []);

  const clearShortcutOperations = useCallback(() => {
    shortcutOperationsRef.current.clear();
  }, []);

  const value = useMemo(
    () => ({
      boundKeyboard,
      blockedKey: penetration,
      stop,
      globalKeys,
      globalSequence,
      focusSet,
      focusNext,
      focusPrev,
      focusCurrent,
      focusUnregister,
      subscribeFocus,
      defineShortcutAction,
      addAction,
      hasAction,
      removeAction,
      modifyAction,
      clearShortcutOperations,
      _pushOwner: pushOwner,
      _popOwner: popOwner,
      boundSequence,
      enableWildcardPriority,
    }),
    [
      boundKeyboard,
      penetration,
      stop,
      globalKeys,
      globalSequence,
      focusSet,
      focusNext,
      focusPrev,
      focusCurrent,
      focusUnregister,
      subscribeFocus,
      defineShortcutAction,
      addAction,
      hasAction,
      removeAction,
      modifyAction,
      clearShortcutOperations,
      pushOwner,
      popOwner,
      boundSequence,
      enableWildcardPriority,
    ],
  );

  useInput((input, key) => {
    const eventNames = normalizeKeyNames(input, key);
    const path = pathRef.current;
    const topComponent = path.length > 0 ? path[path.length - 1] : null;
    const globalKeys = globalKeysRef.current;
    const globalSequences = globalSequencesRef.current;
    const activeIds = activeOverlayIdsRef.current;
    const overlays = displayedOverlaysRef.current;
    const activeOverlays = overlays.filter(n => activeIds.has(n.id))
    const activeCount = activeIds.size;
    const DEFAULT_SEQ_TIMEOUT = 500;

    // Try to start a global pending sequence from an affectOverlay group.
    // Evaluates executeWhenNoOverlay, category whitelist, and cover overrides
    // (only boundSequence can override a global sequence, via the layer's
    // sequences map keyed by first key). When all checks pass and the first
    // key matches, creates a pending state with a timeout timer.
    //
    // Returns true when the event was consumed (first key matched).
    // @2026-06-13 v3.2.0
    const tryStartGlobalSequence = (
      entries: GlobalSequenceEntry[],
      affectOverlay: boolean,
    ): boolean => {
      for (const entry of entries) {
        if ((entry.affectOverlay ?? false) !== affectOverlay) continue;
        // executeWhenNoOverlay only applies to affectOverlay:true entries.
        // affectOverlay:false sequences always work on the screen stack.
        if (affectOverlay && activeCount === 0 && !entry.executeWhenNoOverlay) continue;
        if (!topComponent) continue;

        const cat = entry.category;
        if (cat !== undefined && cat !== '*') {
          if (Array.isArray(cat) && cat.length === 0) continue;
          if (Array.isArray(cat) && !cat.includes(topComponent)) continue;
        }

        // Cover check: only boundSequence can override a global sequence.
        // boundKeyboard is never checked — its keys are single-key bindings
        // that the sequence system always consumes first.
        if (entry.cover !== false) {
          const firstKey = entry.keys[0];
          if (affectOverlay) {
            let anyOverlayHasOverride = false;
            for (const overlay of activeOverlays) {
              const overlayLayer = layersRef.current.get(overlay.id);
              if (overlayLayer?.sequences.has(firstKey)) {
                anyOverlayHasOverride = true;
                break;
              }
            }
            if (anyOverlayHasOverride) continue;
          } else {
            if (topComponent) {
              const topLayer = layersRef.current.get(topComponent);
              if (topLayer?.sequences.has(firstKey)) continue;
            }
          }
        }

        if (eventNames.includes(entry.keys[0])) {
          const timeout = entry.timeout ?? DEFAULT_SEQ_TIMEOUT;
          const pending = {
            sequences: entry.keys,
            nextIndex: 1,
            handler: entry.operate,
            timer: undefined as unknown as NodeJS.Timeout,
            timeout,
            exclusive: entry.exclusive ?? false,
            affectOverlay,
            cover: entry.cover ?? true,
            category: entry.category,
            executeWhenNoOverlay: entry.executeWhenNoOverlay,
          };
          const timer = setTimeout(() => {
            if (globalPendingSeqRef.current === pending) {
              globalPendingSeqRef.current = null;
            }
          }, timeout);
          pending.timer = timer;
          globalPendingSeqRef.current = pending;
          return true;
        }
      }
      return false;
    };

    // Process the currently active global pending sequence.
    // Matches the next expected key, handles exclusive vs non-exclusive
    // mismatch behaviour, and fires the handler when the full sequence
    // is completed.
    //
    // Returns true when the event was consumed by the pending sequence.
    // @2026-06-13 v3.2.0
    const processGlobalPending = (): boolean => {
      const pending = globalPendingSeqRef.current;
      if (pending === null) return false;

      // When no overlays are active and executeWhenNoOverlay is false,
      // an affectOverlay:true pending sequence should be cancelled.
      // affectOverlay:false sequences are unaffected by overlay count.
      if (pending.affectOverlay && activeCount === 0 && !pending.executeWhenNoOverlay) {
        clearTimeout(pending.timer);
        globalPendingSeqRef.current = null;
        return false;
      }

      const expectedKey = pending.sequences[pending.nextIndex];
      if (eventNames.includes(expectedKey)) {
        clearTimeout(pending.timer);
        pending.nextIndex++;
        if (pending.nextIndex === pending.sequences.length) {
          pending.handler();
          globalPendingSeqRef.current = null;
        } else {
          pending.timer = setTimeout(() => {
            if (globalPendingSeqRef.current === pending) {
              globalPendingSeqRef.current = null;
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
      globalPendingSeqRef.current = null;
      return false;
    };

    // Step 1: Global sequences with affectOverlay: true.
    // These have the highest priority in the entire event chain.
    // First drain any active global pending sequence, then try to start
    // a new one from the affectOverlay:true group.
    if (processGlobalPending()) return;
    if (tryStartGlobalSequence(globalSequences, true)) return;

    // 1. 全局键 affectOverlay: true (在所有浮层之前触发)
    for (const entry of globalKeys) {
      if (!entry.affectOverlay) continue;

      // After version 3.0.0, the global key for affectOverlay was turned on
      // They will now only take effect if there is a floating layer.
      // Otherwise, the global key won't take effect anyway
      //
      // But if execute WhenNoOverlay is turned on, things are different.
      // At this point, even if affectOverlay is turned on and the floating layer is gone, it will continue.
      // At this point, it affects the screen stack
      //
      // --------Warning!!!!------: Global keys with affectOverlay and executeWhenNoOverlay turned on have a higher priority than global keys without affectOverlay turned on
      //
      //
      // TODO: I also have to write annoying tests for this feature.
      // TIMESTAMP: 2026-06-11 7:11 CST
      if(activeCount === 0 && !entry.executeWhenNoOverlay) continue

      let anyOverlayHasOverride = false
      if(entry.cover !== false){
        const keyNames = Array.isArray(entry.key) ? entry.key : [entry.key]
        for(const overLay of activeOverlays){
          const overlayLayer = layersRef.current.get(overLay.id);
          if(overlayLayer && keyNames.some(k => overlayLayer.globalKeyOverrides.has(k))){
            anyOverlayHasOverride = true
            break
          }          
        }
      }

      if(anyOverlayHasOverride) continue
      
      if (checkGlobalKey(entry, eventNames, topComponent, layersRef)) {
        if (entry.times !== undefined && entry.times >= 1) {
          entry.pressCount! += 1;
          if (entry.pressCount! < entry.times!) {
            return;
          }
          entry.pressCount = 0;
        }
        entry.operate();
        return;
      }
    }

    // 2. 广播给所有激活浮层（按 zIndex 升序）
    let anyOverlayConsumed = false

    for (const overlay of activeOverlays) {
      const layer = layersRef.current.get(overlay.id);
      if (layer && handleLayer(layer, eventNames, input, key, true, notifyFocusChange, activeCount, true, wildcardPriorityCountRef.current > 0)) {
        anyOverlayConsumed = true;
        // 不 break，继续下一个浮层
      }
    }

    // Step 3: Global sequences with affectOverlay: false.
    // These fire after the overlay layer but before global keys so that
    // a global sequence always outranks any single-key global binding.
    // Same helpers (processGlobalPending / tryStartGlobalSequence) are
    // reused — the pending state carries its own affectOverlay flag so
    // an affectOverlay:true sequence that started in step 1 will have
    // already consumed the event and returned above.
    // @2026-06-13 v3.2.0
    if (processGlobalPending()) return;
    if (tryStartGlobalSequence(globalSequences, false)) return;

    // 3. 全局键 affectOverlay: false (在浮层广播之后、屏幕栈之前触发)
    for (const entry of globalKeys) {
      if (entry.affectOverlay) continue;

      // Fix: In version 3.0.0, Because the check screen stack overrides the global key before the floating layer.
      // Causes the screen stack to fail to overwrite the global key
      // So now we're going to do the same thing in the screen stack.
      //
      //
      // The current cover mechanism is as follows:
      // When affectOverlay is enabled for a global key and cover is true, the screen stack cannot override the global key
      let screenHasOverride = false
      if(entry.cover !== false && topComponent){
        const keyNames = Array.isArray(entry.key) ? entry.key : [entry.key];
        const topLayer = layersRef.current.get(topComponent);
        if(topLayer && keyNames.some(k => topLayer.globalKeyOverrides.has(k))){
          screenHasOverride = true
        }
      }
      if(screenHasOverride) continue
      
      if (checkGlobalKey(entry, eventNames, topComponent, layersRef)) {
        if (entry.times !== undefined && entry.times >= 1) {
          entry.pressCount! += 1;
          if (entry.pressCount! < entry.times!) {
            return;
          }
          entry.pressCount = 0;
        }
        entry.operate();
        return;
      }
    }

    // 4. 屏幕栈（仅当没有激活浮层消费事件时执行）
    if (!anyOverlayConsumed) {
      for (let i = path.length - 1; i >= 0; i--) {
        const comp = path[i];
        const layer = layersRef.current.get(comp);
        if (!layer) continue;
        const isTop = i === path.length - 1;
        if (handleLayer(layer, eventNames, input, key, isTop, notifyFocusChange, activeCount, false, wildcardPriorityCountRef.current > 0)) break;
      }
    }
  });

  return (
    <KeyboardContext.Provider value={value}>
      {children}
    </KeyboardContext.Provider>
  );
}
