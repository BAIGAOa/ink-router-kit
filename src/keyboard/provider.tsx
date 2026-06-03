import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useInput, Key } from 'ink';
import { KeyboardContext } from './context.js';
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
  layersRef: React.MutableRefObject<Map<React.ComponentType<any>, ScreenKeyboardLayer>>,
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
 *   2. Active overlay layer
 *   3. Global keys with `affectOverlay: false` (default)
 *   4. Screen stack (top → bottom)
 *   5. Drop unhandled keys
 *
 * Must be nested inside a {@link ScenarioManagementProvider} so that the
 * current screen path is available for layer management.
 */
export function KeyboardProvider({ children }: KeyboardProviderProps) {
  const { currentPath, currentOverlay } = useScreenSystem();

  // 使用 useRef 替代模块级全局变量，实现多实例隔离
  const pathRef = useRef<React.ComponentType<any>[]>(currentPath);
  const overlayRef = useRef<React.ComponentType<any> | null>(null);
  const globalKeysRef = useRef<{
    key: string | string[];
    operate: () => void;
    cover?: boolean;
    affectOverlay?: boolean;
    category?: React.ComponentType<any>[] | "*";
  }[]>([]);
  const focusSubscribersRef = useRef(new Set<() => void>());

  // 存储快捷操作的集合
  // 在某些场景下为了防止多次重复定义某个操作
  // 以及为了可以JSON配置化，我们就需要这个东西
  const shortcutOperationsRef = useRef(
    new Map<string, { action: () => void; keys?: string[] }>()
  );

  // 每次渲染同步最新值（无副作用，只是指针赋值）
  pathRef.current = currentPath;
  overlayRef.current = currentOverlay
    ? (currentOverlay as React.ReactElement).type as React.ComponentType<any>
    : null;

  const layersRef = useRef<
    Map<
      React.ComponentType<any>,
      ScreenKeyboardLayer
    >
  >(new Map());

  const prevPathRef = useRef<React.ComponentType<any>[]>([]);

  // 覆盖层是独立的
  const prevOverlayRef = useRef<React.ComponentType<any> | null>(null);


  useEffect(() => {
    const prev = prevPathRef.current;
    for (const comp of prev) {
      if (!currentPath.includes(comp)) {
        layersRef.current.delete(comp);
      }
    }
    prevPathRef.current = currentPath;
  }, [currentPath]);

  // Fix: 添加覆盖层的清理逻辑
  useEffect(() => {
    if (prevOverlayRef.current && !currentOverlay) {
      layersRef.current.delete(prevOverlayRef.current);
    }
    prevOverlayRef.current = currentOverlay
      ? (currentOverlay as React.ReactElement).type as React.ComponentType<any>
      : null;
  }, [currentOverlay])

  const getLayer = useCallback(
    (owner: React.ComponentType<any>) => {
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
          actionKeysMap: new Map(), // 用于存储 action ID 到 keys 的映射（屏幕级别）
        };
        layersRef.current.set(owner, layer);
      }
      return layer;
    },
    [],
  );

  const getCurrentOwner = useCallback((): React.ComponentType<any> | null => {
    const path = pathRef.current;
    if (path.length === 0) return null;
    return overlayRef.current || path[path.length - 1];
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
          actionKeysMap: new Map(), // 用于存储 action ID 到 keys 的映射（焦点目标级别）
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
   * Bind keys on the current (top-of-stack) screen component.
   *
   * The owner is automatically set to the current top-of-stack component.
   * Returns an unbind function for cleanup.
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
        owner: React.ComponentType<any>,
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
        owner: React.ComponentType<any>,
        layer: ScreenKeyboardLayer,
        bindingContext: string,
      ): void {
        for (const gk of globalKeysRef.current) {
          const gkKeys = Array.isArray(gk.key) ? gk.key : [gk.key];
          const matchingKeys = gkKeys.filter((k) => keys.includes(k));
          if (matchingKeys.length === 0) continue;

          const cat = gk.category;
          let inCategory = false;
          if (cat === undefined || cat === '*') {
            inCategory = true;
          } else if (Array.isArray(cat)) {
            inCategory = cat.includes(owner);
          }
          if (!inCategory) continue;

          const cover = gk.cover ?? true;
          if (!cover) {
            throw new Error(
              `[Ink-Router-Kit] Component "${owner.displayName || owner.name || 'anonymous'}" ` +
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
        // 递归调用原有实现
        return boundKeyboard(entry.keys, actionId, options);
      }

      // 原有调用方式
      const keys = keysOrActionId as string[];
      const handler = handlerOrOptions as KeyHandler | string;
      const options = maybeOptions;

      const owner = getCurrentOwner();
      if (!owner) {
        throw new Error(
          '[Ink-Router-Kit] boundKeyboard() must be called inside a screen component. There is currently no active screen.',
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

        return () => {
          const idx = target!.bindings.indexOf(entry);
          if (idx !== -1) target!.bindings.splice(idx, 1);
          cleanupGlobalKeyOverrides(layer, entry.keys);
          // 解绑时同步清理 actionKeysMap
          if (typeof handler === 'string') {
            removeKeysFromActionMap(target!.actionKeysMap, handler, keys);
          }
        };
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

      return () => {
        const idx = layer.bindings.indexOf(entry);
        if (idx !== -1) layer.bindings.splice(idx, 1);
        cleanupGlobalKeyOverrides(layer, entry.keys);
        // 解绑时同步清理 actionKeysMap
        if (typeof handler === 'string') {
          removeKeysFromActionMap(layer.actionKeysMap, handler, keys);
        }
      };
    },
    [getCurrentOwner, getLayer, getOrCreateFocusTarget],
  );

  /**
   * Mark keys as transparent on the current layer.
   *
   * When a transparent key reaches this layer, the layer's own bindings
   * are skipped and the key propagates to the next layer below.
   */
  const penetration = useCallback(
    (keys: string[], options?: BlockedKeyOptions): (() => void) => {
      const owner = getCurrentOwner();
      if (!owner) {
        throw new Error('[Ink-Router-Kit] blockedKey() must be called inside a screen component.');
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

      // 向后兼容
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
   * Prevent keys from propagating beyond the current (top-of-stack) layer.
   *
   * The layer's own bindings are evaluated first — only if no binding
   * matches does the stop take effect, consuming the key so that lower
   * layers never see it. The returned unstop function removes the keys.
   */
  const stop = useCallback(
    (keys: string[], options?: StopOptions): (() => void) => {
      const owner = getCurrentOwner();
      if (!owner) {
        throw new Error('[Ink-Router-Kit] stop() must be called inside a screen component.');
      }
      const layer = getLayer(owner);

      // 如果启用 stopAction 模式，则将传入的 action ID 转换为对应的键名
      let effectiveKeys: string[] = keys;
      if (options?.stopAction) {
        const map = options.focusId
          ? getOrCreateFocusTarget(layer, options.focusId).actionKeysMap
          : layer.actionKeysMap;
        const merged: string[] = [];
        for (const actionId of keys) {
          const boundKeys = map.get(actionId);
          if (boundKeys) {
            for (const k of boundKeys) {
              if (!merged.includes(k)) merged.push(k);
            }
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
        // 之前的stop逻辑，为了向后兼容得以保留
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
      const ownerName = (owner as any).displayName || owner.name || 'Unknown';
      const layer = layersRef.current.get(owner);
      if (!layer) {
        throw new Error(
          `focusSet("${focusId}"): no keyboard layer found for screen "${ownerName}". ` +
          `Did you forget to wrap the screen in <KeyboardProvider>?`,
        );
      }
      if (!layer.focusTargets.has(focusId)) {
        const available = layer.focusOrder.length > 0
          ? layer.focusOrder.map(id => `"${id}"`).join(', ')
          : '(none)';
        throw new Error(
          `focusSet("${focusId}"): focus target not found on screen "${ownerName}". ` +
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
   *
   * Global keys fire independently of the screen stack (subject to
   * `category` whitelist and `affectOverlay` placement).
   *
   * Calling this replaces any previously registered global keys.
   */
  const globalKeys = useCallback(
    (entries: GlobalKeyEntry[], options?: { mode?: 'replace' | 'add' }) => {
      const processed = entries.map((each) => {
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
          };
        }
        return {
          key: each.key,
          operate: each.operate,
          cover: each.cover,
          category: each.category,
          affectOverlay: each.affectOverlay,
        };
      });

      if (options?.mode === 'add') {
        // Append to existing global keys (backward-compatible addition)
        globalKeysRef.current = [...globalKeysRef.current, ...processed];
      } else {
        // Replace (default behavior, backward compatible)
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
      // 存储 action 函数和可选的 keys
      shortcutOperationsRef.current.set(each.actionId, {
        action: each.action,
        keys: each.keys,
      })
    }
  }, [])

  /**
   * Modify the default keys of an existing shortcut action.
   *
   * @param actionId - Unique identifier of the action.
   * @param keys     - New key names to replace the previous default keys.
   * @throws If the action does not exist or was not registered with a `keys` field.
   */
  const modifyAction = useCallback((actionId: string, keys: string[]) => {
    const entry = shortcutOperationsRef.current.get(actionId);
    if (!entry) {
      throw new Error(`[Ink-Router-Kit] Cannot modify action "${actionId}": action not registered.`);
    }
    // 原注册时没有提供 keys 字段，不允许修改（静默失败原则直接报错）
    if (entry.keys === undefined) {
      throw new Error(`[Ink-Router-Kit] Cannot modify action "${actionId}": action was not registered with a 'keys' field.`);
    }
    // 直接覆盖
    entry.keys = keys;
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
      modifyAction,
      clearShortcutOperations,
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
      modifyAction,
      clearShortcutOperations,
    ],
  );

  useInput((input, key) => {
    const eventNames = normalizeKeyNames(input, key);
    const path = pathRef.current;
    const topComponent = path.length > 0 ? path[path.length - 1] : null;
    const overlayComp = overlayRef.current;
    const globalKeys = globalKeysRef.current;


    for (const entry of globalKeys) {
      if (!entry.affectOverlay) continue;
      // Allow the active overlay to override a global key (same as the
      // top screen can — via boundKeyboard setting globalKeyOverrides).
      if (overlayComp && entry.cover !== false) {
        const overlayLayer = layersRef.current.get(overlayComp);
        if (overlayLayer) {
          const keyNames = Array.isArray(entry.key) ? entry.key : [entry.key];
          if (keyNames.some((k) => overlayLayer.globalKeyOverrides.has(k))) continue;
        }
      }
      if (checkGlobalKey(entry, eventNames, topComponent, layersRef)) {
        entry.operate();
        return;
      }
    }


    if (overlayComp) {
      const overlayLayer = layersRef.current.get(overlayComp);
      if (overlayLayer) {
        if (handleTabNavigation(overlayLayer, eventNames, key.shift, notifyFocusChange)) return;

        const blocked = overlayLayer.blockedKeys;
        const unblocked = eventNames.filter((n) => !blocked.includes(n));


        const focusId = overlayLayer.currentFocusId;
        if (focusId) {
          const ft = overlayLayer.focusTargets.get(focusId);
          if (ft) {
            const fBlocked = ft.blockedKeys;
            const fUnblocked = unblocked.filter((n) => !fBlocked.includes(n));

            if (tryMatchBindings(ft.bindings, fUnblocked, input, key)) return;

            if (eventNames.some((n) => ft.stoppedKeys.includes(n))) {
              return;
            }
          }
        }

        if (tryMatchBindings(overlayLayer.bindings, unblocked, input, key)) return;

        if (eventNames.some((n) => overlayLayer.stoppedKeys.includes(n))) {
          return;
        }
      }
    }


    for (const entry of globalKeys) {
      if (entry.affectOverlay) continue;
      if (checkGlobalKey(entry, eventNames, topComponent, layersRef)) {
        entry.operate();
        return;
      }
    }


    for (let i = path.length - 1; i >= 0; i--) {
      const comp = path[i];
      const layer = layersRef.current.get(comp);
      if (!layer) continue;
      const isTop = i === path.length - 1;

      if (isTop && handleTabNavigation(layer, eventNames, key.shift, notifyFocusChange)) return;

      const blocked = layer.blockedKeys;
      const unblocked = eventNames.filter((n) => !blocked.includes(n));

      if (isTop && layer.currentFocusId) {
        const ft = layer.focusTargets.get(layer.currentFocusId);
        if (ft) {
          const fBlocked = ft.blockedKeys;
          const fUnblocked = unblocked.filter((n) => !fBlocked.includes(n));

          const skipOnlyThis = (b: BoundKeyEntry) => b.onlyThis && overlayComp !== null;
          if (tryMatchBindings(ft.bindings, fUnblocked, input, key, skipOnlyThis)) return;

          if (eventNames.some((n) => ft.stoppedKeys.includes(n))) {
            return;
          }
        }
      }

      const skipOnlyThis = (b: BoundKeyEntry) =>
        b.onlyThis && (i !== path.length - 1 || overlayComp !== null);
      if (tryMatchBindings(layer.bindings, unblocked, input, key, skipOnlyThis)) return;

      if (isTop && eventNames.some((n) => layer.stoppedKeys.includes(n))) {
        return;
      }
    }
  });

  return (
    <KeyboardContext.Provider value={value}>
      {children}
    </KeyboardContext.Provider>
  );
}
