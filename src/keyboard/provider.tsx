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

let _currentPath: React.ComponentType<any>[] = [];
let _currentOverlayComponent: React.ComponentType<any> | null = null;
let _globalKeys: {
  key: string | string[];
  operate: () => void;
  cover?: boolean;
  affectOverlay?: boolean;
  category?: React.ComponentType<any>[] | "*";
}[] = [];
let _focusSubscribers = new Set<() => void>();

// 存储快捷操作的集合
// 在某些场景下为了防止多次重复定义某个操作
// 以及为了可以JSON配置化，我们就需要这个东西
let _shortcutOperations = new Map<string, () => void>()

export function clearShortcutOperations(){
  _shortcutOperations.clear()
}

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


function notifyFocusChange() {
  _focusSubscribers.forEach(fn => fn());
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

  _currentPath = currentPath;

  _currentOverlayComponent = currentOverlay
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
          actionTargets: [],
        };
        layersRef.current.set(owner, layer);
      }
      return layer;
    },
    [],
  );

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

  function getCurrentOwner(): React.ComponentType<any> | null {
    const path = _currentPath;
    if (path.length === 0) return null;
    return _currentOverlayComponent || path[path.length - 1];
  }

  function createBoundKeyEntry(
    keys: string[],
    handler: KeyHandler | string,
    onlyThis: boolean,
    owner: React.ComponentType<any>,
  ): BoundKeyEntry {
    if (typeof handler === 'string') {
      const action = _shortcutOperations.get(handler);
      if (!action) {
        throw new Error(
          `[Ink-Router-Kit] The shortcut key you used does not exist with ID ${handler}`,
        );
      }
      return { keys, handler: action, onlyThis, owner };
    }
    return { keys, handler, onlyThis, owner };
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

  function applyGlobalKeyOverrides(
    keys: string[],
    owner: React.ComponentType<any>,
    layer: ScreenKeyboardLayer,
    bindingContext: string,
  ): void {
    for (const gk of _globalKeys) {
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

  const getOrCreateFocusTarget = useCallback(
    (layer: ScreenKeyboardLayer, focusId: string) => {
      let target = layer.focusTargets.get(focusId);
      if (!target) {
        target = { bindings: [], blockedKeys: [], stoppedKeys: [] };
        layer.focusTargets.set(focusId, target);
        layer.focusOrder.push(focusId);
        if (layer.currentFocusId === null) {
          layer.currentFocusId = focusId;
          notifyFocusChange();
        }
      }
      return target;
    },
    [],
  );

  /**
   * Bind keys on the current (top-of-stack) screen component.
   *
   * The owner is automatically set to the current top-of-stack component.
   * Returns an unbind function for cleanup.
   */
  const boundKeyboard = useCallback(
    (
      keys: string[],
      handler: KeyHandler | string,
      options?: BoundKeyboardOptions,
    ): (() => void) => {
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

        return () => {
          const idx = target!.bindings.indexOf(entry);
          if (idx !== -1) target!.bindings.splice(idx, 1);
          cleanupGlobalKeyOverrides(layer, entry.keys);
        };


      }


      applyGlobalKeyOverrides(keys, owner, layer, 'boundKeyboard');

      const entry = createBoundKeyEntry(keys, handler, options?.onlyThis ?? false, owner);

      layer.bindings.push(entry);

      return () => {
        const idx = layer.bindings.indexOf(entry);
        if (idx !== -1) layer.bindings.splice(idx, 1);
        cleanupGlobalKeyOverrides(layer, entry.keys);
      };
    },
    [getLayer],
  );

  /**
   * Mark keys as transparent on the current layer.
   *
   * When a transparent key reaches this layer, the layer's own bindings
   * are skipped and the key propagates to the next layer below.
   */
  const penetration = useCallback(
    (keys: string[], options?: BlockedKeyOptions) => {
      const owner = getCurrentOwner();
      if (!owner) {
        throw new Error('[Ink-Router-Kit] blockedKey() must be called inside a screen component.');
      }
      const layer = getLayer(owner);

      if (options?.focusId) {
        const target = getOrCreateFocusTarget(layer, options.focusId);
        for (const k of keys) {
          if (!target.blockedKeys.includes(k)) {
            target.blockedKeys.push(k);
          }
        }
      } else {
        // 向后兼容
        for (const k of keys) {
          if (!layer.blockedKeys.includes(k)) {
            layer.blockedKeys.push(k);
          }
        }
      }
    },
    [getLayer],
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

      if (options?.focusId) {
        const target = getOrCreateFocusTarget(layer, options.focusId);
        const added: string[] = [];
        for (const k of keys) {
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
        for (const k of keys) {
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
    [getLayer],
  );


  const subscribeFocus = useCallback((listener: () => void) => {
    _focusSubscribers.add(listener);
    return () => { _focusSubscribers.delete(listener); };
  }, []);

  const focusSet = useCallback(
    (focusId: string) => {
      const owner = getCurrentOwner();
      if (!owner) return;
      const layer = layersRef.current.get(owner);
      if (!layer || !layer.focusTargets.has(focusId)) return;
      if (layer.currentFocusId !== focusId) {
        layer.currentFocusId = focusId;
        notifyFocusChange();
      }
    },
    [],
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
  }, []);

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
  }, []);

  const focusCurrent = useCallback((): string | null => {
    const owner = getCurrentOwner();
    if (!owner) return null;
    const layer = layersRef.current.get(owner);
    return layer?.currentFocusId ?? null;
  }, []);

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
  }, []);

  /**
   * Register global key bindings.
   *
   * Global keys fire independently of the screen stack (subject to
   * `category` whitelist and `affectOverlay` placement).
   *
   * Calling this replaces any previously registered global keys.
   */
  const globalKeys = useCallback(
    (entries: GlobalKeyEntry[]) => {
      // 根据预期特性，每一次调用都应该重置全局键集合
      // 后续都是这样，所以每次调用都相当于直接替换
      _globalKeys = []
      for (const each of entries) {
        if (typeof each.operate === 'string') {
          const action = _shortcutOperations.get(each.operate)
          if(!action){
            throw new Error(`[Ink-Kit-Router]You want to call the shortcut ${each.operate} in the global key, but it is not registered`)
          }
          _globalKeys.push({
            key: each.key,
            operate: action,
            cover: each.cover,
            category: each.category,
            affectOverlay: each.affectOverlay
          })
        } else {
          _globalKeys.push({
            key: each.key,
            operate: each.operate,
            cover: each.cover,
            category: each.category,
            affectOverlay: each.affectOverlay 
          })
        }
    
      }
    },
    [],
  );

  const defineShortcutAction = useCallback((entries: ShortcutOperationEntry[]) => {
    for (const each of entries) {
      if (_shortcutOperations.has(each.actionId)) {
        throw new Error(`[Ink-Router-Kit]Duplicate shortcut cannot be defined with ID ${each.actionId}`)
      }
      _shortcutOperations.set(each.actionId, each.action)
    }
  }, [])

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
      defineShortcutAction
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
      defineShortcutAction
    ],
  );

  useInput((input, key) => {
    const eventNames = normalizeKeyNames(input, key);
    const path = _currentPath;
    const topComponent = path.length > 0 ? path[path.length - 1] : null;
    const overlayComp = _currentOverlayComponent;


    for (const entry of _globalKeys) {
      if (!entry.affectOverlay) continue;
      if (checkGlobalKey(entry, eventNames, topComponent, layersRef)) {
        entry.operate();
        return;
      }
    }


    if (overlayComp) {
      const overlayLayer = layersRef.current.get(overlayComp);
      if (overlayLayer) {
        if (handleTabNavigation(overlayLayer, eventNames, key.shift)) return;

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


    for (const entry of _globalKeys) {
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

      if (isTop && handleTabNavigation(layer, eventNames, key.shift)) return;

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
