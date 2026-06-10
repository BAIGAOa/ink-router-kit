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
  BlockedKeyOptions,
  StopOptions,
  ShortcutOperationEntry,
} from './types.js';
import { useScreenSystem } from '../screen/hook.js';

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
  if (topLayer) {
    if (keyNames.some((k) => topLayer.globalKeyOverrides.has(k))) return false;
  }

  return true;
}

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

// 从 actionKeysMap 中移除指定 actionId 对应的 keys（若集合为空则删除整个条目）
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
  }[]>([]);
  const focusSubscribersRef = useRef(new Set<() => void>());

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

          const cat = gk.category;
          let inCategory = false;

          // Category applies to screen components, not overlay IDs
          if (typeof owner !== 'string') {
            if (cat === undefined || cat === '*') {
              inCategory = true;
            } else if (Array.isArray(cat)) {
              inCategory = cat.includes(owner);
            }
          }

          // For overlay owners, category checks are skipped (overlays don't override global keys by category)
          if (typeof owner === 'string' && matchingKeys.length > 0) continue;

          if (!inCategory) continue;

          const cover = gk.cover ?? true;
          if (!cover) {
            const ownerName = typeof owner === 'string' ? owner : (owner.displayName || owner.name || 'anonymous');
            throw new Error(
              `[Ink-Router-Kit] Component "${ownerName}" ` +
              `attempted to bind "${matchingKeys[0]}" via ${bindingContext}, ` +
              `but this key is already declared in globalKeys with cover: false, so overriding is not allowed.`,
            );
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
    [getCurrentOwner, notifyFocusChange],
  );

  const focusNext = useCallback(() => {
    const owner = getCurrentOwner();
    if (!owner) return;
    const layer = layersRef.current.get(owner);
    if (!layer || layer.focusOrder.length === 0) return;

    const current = layer.currentFocusId;
    let idx = current ? layer.focusOrder.indexOf(current) : -1;
    idx = (idx + 1) % layer.focusOrder.length;
    layer.currentFocusId = layer.focusOrder[idx];
    notifyFocusChange();
  }, [getCurrentOwner, notifyFocusChange]);

  const focusPrev = useCallback(() => {
    const owner = getCurrentOwner();
    if (!owner) return;
    const layer = layersRef.current.get(owner);
    if (!layer || layer.focusOrder.length === 0) return;

    const current = layer.currentFocusId;
    let idx = current ? layer.focusOrder.indexOf(current) : -1;
    idx = idx <= 0 ? layer.focusOrder.length - 1 : idx - 1;
    layer.currentFocusId = layer.focusOrder[idx];
    notifyFocusChange();
  }, [getCurrentOwner, notifyFocusChange]);

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
    }),
    [
      boundKeyboard,
      penetration,
      stop,
      globalKeys,
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
    ],
  );

  useInput((input, key) => {
    const eventNames = normalizeKeyNames(input, key);
    const path = pathRef.current;
    const topComponent = path.length > 0 ? path[path.length - 1] : null;
    const globalKeys = globalKeysRef.current;
    const activeIds = activeOverlayIdsRef.current;
    const overlays = displayedOverlaysRef.current;

    // 1. 全局键 affectOverlay: true (在所有浮层之前触发)
    for (const entry of globalKeys) {
      if (!entry.affectOverlay) continue;

      // Check all active overlays for globalKeyOverrides
      const activeOverlays = overlays.filter(o => activeIds.has(o.id));
      const anyOverlayHasOverride = activeOverlays.some(overlay => {
        const overlayLayer = layersRef.current.get(overlay.id);
        if (!overlayLayer) return false;
        const keyNames = Array.isArray(entry.key) ? entry.key : [entry.key];
        return keyNames.some((k) => overlayLayer.globalKeyOverrides.has(k));
      });
      if (entry.cover !== false && anyOverlayHasOverride) continue;

      // Also check top component override
      if (entry.cover !== false && topComponent) {
        const topLayer = layersRef.current.get(topComponent);
        if (topLayer) {
          const keyNames = Array.isArray(entry.key) ? entry.key : [entry.key];
          if (keyNames.some((k) => topLayer.globalKeyOverrides.has(k))) continue;
        }
      }

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
    let anyOverlayConsumed = false;
    const activeOverlays = overlays.filter(o => activeIds.has(o.id));
    const activeCount = activeIds.size;

    for (const overlay of activeOverlays) {
      const layer = layersRef.current.get(overlay.id);
      if (layer && handleLayer(layer, eventNames, input, key, true, notifyFocusChange, activeCount, true)) {
        anyOverlayConsumed = true;
        // 不 break，继续下一个浮层
      }
    }

    // 3. 全局键 affectOverlay: false (在浮层广播之后、屏幕栈之前触发)
    for (const entry of globalKeys) {
      if (entry.affectOverlay) continue;
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
        if (handleLayer(layer, eventNames, input, key, isTop, notifyFocusChange, activeCount, false)) break;
      }
    }
  });

  return (
    <KeyboardContext.Provider value={value}>
      {children}
    </KeyboardContext.Provider>
  );
}
