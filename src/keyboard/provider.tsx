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
} from './types.js';
import { useScreenSystem } from '../screen/hook.js';



/** 当前屏幕路径（由 Provider 同步更新） */
let _currentPath: React.ComponentType<any>[] = [];

/** 当前 overlay 组件类型（由 Provider 同步更新） */
let _currentOverlayComponent: React.ComponentType<any> | null = null;



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

  // 特殊键（Ink 7 支持的完整列表）
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
      // 基础名
      names.push(kName);
      // 带修饰符的组合名
      if (key.ctrl) names.push(`ctrl+${kName}`);
      if (key.shift) names.push(`shift+${kName}`);
      if (key.meta) names.push(`meta+${kName}`);
      return names; // 特殊键直接返回，不继续处理普通字符
    }
  }

  // 普通字符键
  if (input) {
    names.push(input);
    if (key.ctrl) names.push(`ctrl+${input}`);
    if (key.shift) names.push(`shift+${input}`);
    if (key.meta) names.push(`meta+${input}`);
    if (key.ctrl && key.shift) names.push(`ctrl+shift+${input}`);
  }

  return names;
}


export interface KeyboardProviderProps {
  children: ReactNode;
}

/**
 * Keyboard context provider for layered key handling.
 *
 * Manages per-screen-layer key bindings, transparent keys (`blockedKey`),
 * and key-stop propagation barriers (`stop`). Handles the full event
 * priority chain:
 *   1. Active overlay layer
 *   2. Screen stack (top → bottom)
 *   3. Drop unhandled keys
 *
 * Must be nested inside a {@link ScenarioManagementProvider} so that the
 * current screen path is available for layer management.
 */
export function KeyboardProvider({ children }: KeyboardProviderProps) {
  const { currentPath, currentOverlay } = useScreenSystem();

  // 同步模块级变量（render 阶段，先于 children 渲染）
  _currentPath = currentPath;

  // 从 currentOverlay 元素中提取组件类型
  _currentOverlayComponent = currentOverlay
    ? (currentOverlay as React.ReactElement).type as React.ComponentType<any>
    : null;

  // 每层的绑定数据：Map<component, layer>
  const layersRef = useRef<
    Map<
      React.ComponentType<any>,
      ScreenKeyboardLayer
    >
  >(new Map());

  // 追踪上一次的路径，用于清理已离开的层
  const prevPathRef = useRef<React.ComponentType<any>[]>([]);

  // 当路径变化时，清理已离开路径的层
  useEffect(() => {
    const prev = prevPathRef.current;
    for (const comp of prev) {
      if (!currentPath.includes(comp)) {
        layersRef.current.delete(comp);
      }
    }
    prevPathRef.current = currentPath;
  }, [currentPath]);

  // 获取或创建指定组件的层
  const getLayer = useCallback(
    (owner: React.ComponentType<any>) => {
      let layer = layersRef.current.get(owner);
      if (!layer) {
        layer = { bindings: [], blockedKeys: [], stoppedKeys: [] };
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

      const entry: BoundKeyEntry = {
        keys,
        handler,
        onlyThis: options?.onlyThis ?? false,
        owner,
      };

      layer.bindings.push(entry);

      // 返回解绑函数
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


  const value = useMemo(
    () => ({ boundKeyboard, blockedKey: penetration, stop }),
    [boundKeyboard, penetration],
  );


  useInput((input, key) => {
    const eventNames = normalizeKeyNames(input, key);

    const overlayComp = _currentOverlayComponent;
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

        // overlay 层 stop 阻断整个屏幕栈
        if (eventNames.some((n) => overlayLayer.stoppedKeys.includes(n))) {
          return;
        }
      }
    }

    const path = _currentPath;
    for (let i = path.length - 1; i >= 0; i--) {
      const comp = path[i];
      const layer = layersRef.current.get(comp);
      if (!layer) continue;

      const isTop = i === path.length - 1;

      const blocked = layer.blockedKeys;
      const unblocked = eventNames.filter((n) => !blocked.includes(n));

      if (unblocked.length > 0) {
        for (const binding of layer.bindings) {
          if (binding.onlyThis && (i !== path.length - 1 || _currentOverlayComponent !== null)) continue;
          if (binding.keys.some((k) => unblocked.includes(k))) {
            binding.handler(input, key);
            return;
          }
        }
      }

      // 仅栈顶层可阻断向下传播；先检查绑定再检查 stop（stop 不影响本层绑定）
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
