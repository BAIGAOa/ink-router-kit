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
} from './types.js';
import { useScreenSystem } from '../screen/hook.js';

let _currentPath: React.ComponentType<any>[] = [];
let _currentOverlayComponent: React.ComponentType<any> | null = null;
let _globalKeys: GlobalKeyEntry[] = [];

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

  return names;
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

  useEffect(() => {
    const prev = prevPathRef.current;
    for (const comp of prev) {
      if (!currentPath.includes(comp)) {
        layersRef.current.delete(comp);
      }
    }
    prevPathRef.current = currentPath;
  }, [currentPath]);

  const getLayer = useCallback(
    (owner: React.ComponentType<any>) => {
      let layer = layersRef.current.get(owner);
      if (!layer) {
        layer = {
          bindings: [],
          blockedKeys: [],
          stoppedKeys: [],
          globalKeyOverrides: new Set(),
        };
        layersRef.current.set(owner, layer);
      }
      return layer;
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
      handler: KeyHandler,
      options?: BoundKeyboardOptions,
    ): (() => void) => {
      const path = _currentPath;
      if (path.length === 0) {
        throw new Error(
          '[Ink-Trc] boundKeyboard() 必须在屏幕组件内调用。当前无活跃屏幕。',
        );
      }
      const owner = path[path.length - 1];
      const layer = getLayer(owner);

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
            `[Ink-Trc] 组件 "${owner.displayName || owner.name || 'anonymous'}" 尝试通过 boundKeyboard 绑定 "${matchingKeys[0]}"，但该键已被 globalKeys 声明且 cover: false，不允许覆盖。`,
          );
        }

        for (const k of matchingKeys) {
          layer.globalKeyOverrides.add(k);
        }
      }

      const entry: BoundKeyEntry = {
        keys,
        handler,
        onlyThis: options?.onlyThis ?? false,
        owner,
      };

      layer.bindings.push(entry);

      return () => {
        const idx = layer.bindings.indexOf(entry);
        if (idx !== -1) {
          layer.bindings.splice(idx, 1);
        }
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
    (keys: string[]) => {
      const path = _currentPath;
      if (path.length === 0) {
        throw new Error(
          '[Ink-Trc] blockedKey() 必须在屏幕组件内调用。',
        );
      }
      const owner = path[path.length - 1];
      const layer = getLayer(owner);

      for (const k of keys) {
        if (!layer.blockedKeys.includes(k)) {
          layer.blockedKeys.push(k);
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
    (keys: string[]): (() => void) => {
      const path = _currentPath;
      if (path.length === 0) {
        throw new Error('[Ink-Trc] stop() 必须在屏幕组件内调用。');
      }
      const owner = path[path.length - 1];
      const layer = getLayer(owner);

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
    },
    [getLayer],
  );

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
      _globalKeys = entries;
    },
    [],
  );

  const value = useMemo(
    () => ({
      boundKeyboard,
      blockedKey: penetration,
      stop,
      globalKeys,
    }),
    [boundKeyboard, penetration, stop, globalKeys],
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
        const blocked = overlayLayer.blockedKeys;
        const unblocked = eventNames.filter((n) => !blocked.includes(n));

        if (unblocked.length > 0) {
          for (const binding of overlayLayer.bindings) {
            if (binding.keys.some((k) => unblocked.includes(k))) {
              binding.handler(input, key);
              return;
            }
          }
        }

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

      const blocked = layer.blockedKeys;
      const unblocked = eventNames.filter((n) => !blocked.includes(n));

      if (unblocked.length > 0) {
        for (const binding of layer.bindings) {
          if (
            binding.onlyThis &&
            (i !== path.length - 1 || _currentOverlayComponent !== null)
          )
            continue;

          if (binding.keys.some((k) => unblocked.includes(k))) {
            binding.handler(input, key);
            return;
          }
        }
      }

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