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
  ResolvedGlobalSequenceEntry,
  BlockedKeyOptions,
  StopOptions,
  ShortcutOperationEntry,
  SequenceOptions,
  SequenceBinding,
  SequenceOperationEntry,
} from './types.js';
import { useScreenSystem } from '../screen/hook.js';
import { buildPipelineContext } from './pipeline/index.js';
import { runPipeline } from './pipeline/index.js';

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
  const globalSequencesRef = useRef<ResolvedGlobalSequenceEntry[]>([]);
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
  const sequenceOperationsRef = useRef(
    new Map<string, {action: () => void, keys?: string[], timeout?: number}>
  )

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
      keysOrActionId: string[] | string,
      handlerOrOptions?: KeyHandler | SequenceOptions,
      maybeOptions?: SequenceOptions,
    ): (() => void) => {
      // Overload: boundSequence(actionId: string, options?: SequenceOptions)
      // Resolves the action's predefined keys and handler from sequenceOperationsRef.
      if (typeof keysOrActionId === 'string' && (typeof handlerOrOptions === 'undefined' || typeof handlerOrOptions === 'object')) {
        const actionId = keysOrActionId;
        const options = handlerOrOptions as SequenceOptions | undefined;
        const entry = sequenceOperationsRef.current.get(actionId);
        if (!entry) {
          throw new Error(
            `[Ink-Router-Kit] Sequence action "${actionId}" is not registered.`,
          );
        }
        if (!entry.keys || entry.keys.length === 0) {
          throw new Error(
            `[Ink-Router-Kit] Sequence action "${actionId}" does not have predefined keys. Please register with a keys field or call boundSequence with explicit keys.`,
          );
        }
        // Use the action's timeout as default unless overridden by options.
        const mergedOptions: SequenceOptions = {
          ...(entry.timeout !== undefined ? { timeout: entry.timeout } : {}),
          ...options,
        };
        return boundSequence(entry.keys, entry.action, mergedOptions);
      }

      const keys = keysOrActionId as string[];
      const handler = handlerOrOptions as KeyHandler;
      const options = maybeOptions;

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
      // Resolve string operate references to actual functions from
      // sequenceOperationsRef, mirroring how globalKeys resolves
      // shortcut action IDs.
      const resolved: ResolvedGlobalSequenceEntry[] = entries.map((entry) => {
        if (typeof entry.operate === 'string') {
          const actionEntry = sequenceOperationsRef.current.get(entry.operate);
          if (!actionEntry) {
            throw new Error(
              `[Ink-Router-Kit] You want to call the sequence action "${entry.operate}" in globalSequence, but it is not registered.`,
            );
          }
          return { ...entry, operate: actionEntry.action };
        }
        // TS narrows entry.operate to () => void after the typeof check above.
        return { ...entry, operate: entry.operate };
      });

      for (const entry of resolved) {
        if (entry.keys.length < 2) {
          throw new Error(
            '[Ink-Router-Kit] globalSequence() requires at least 2 keys per sequence.',
          );
        }
      }

      if (options?.mode === 'add') {
        globalSequencesRef.current = [...globalSequencesRef.current, ...resolved];
      } else {
        // Clear any active pending sequence when replacing all entries.
        if (globalPendingSeqRef.current) {
          clearTimeout(globalPendingSeqRef.current.timer);
          globalPendingSeqRef.current = null;
        }
        globalSequencesRef.current = resolved;
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

  const defineSequenceAction = useCallback((entries: SequenceOperationEntry[]) => {
    for(const each of entries){
      if(sequenceOperationsRef.current.has(each.sequenceActionId)){
        throw new Error(
          `[Ink-Router-Kit]Sequence Action ${each.sequenceActionId} may not be defined repeatedly`
        )
      }
      sequenceOperationsRef.current.set(each.sequenceActionId, {
        action: each.action,
        keys: each.keys,
        timeout: each.timeout,
      })
    }
  }, [] )


  const modifySequenceAction = useCallback((actionId: string, keys: string[], timeout?: number) => {
    const entry = sequenceOperationsRef.current.get(actionId)
    if(!entry){
      throw new Error(
        `[Ink-Router-Kit]Key not registered to Sequence Action cannot be modified, target ID is ${actionId}`
      )
    }
    if(entry.keys === undefined){
      throw new Error(
        `[Ink-Router-Kit]The target Sequence Action has no preset Keys. You cannot modify it. The ID is ${actionId}.`
      )
    }

    entry.keys = keys
    
    if(timeout){
      if(entry.timeout === undefined){
        throw new Error(
          `[Ink-Kit-Router]Target Sequence Action has no default Timeout, you cannot modify, ID is ${actionId}`
        )
      }
      
      entry.timeout = timeout
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

  const addSequenceAction = useCallback((entry: SequenceOperationEntry) => {
    if (sequenceOperationsRef.current.has(entry.sequenceActionId)) {
      throw new Error(
        `[Ink-Router-Kit] Sequence Action ${entry.sequenceActionId} may not be defined repeatedly`,
      );
    }
    sequenceOperationsRef.current.set(entry.sequenceActionId, {
      action: entry.action,
      keys: entry.keys,
      timeout: entry.timeout,
    });
  }, []);

  const hasSequenceAction = useCallback((sequenceActionId: string): boolean => {
    return sequenceOperationsRef.current.has(sequenceActionId);
  }, []);

  const removeSequenceAction = useCallback((sequenceActionId: string) => {
    if (!sequenceOperationsRef.current.has(sequenceActionId)) {
      throw new Error(
        `[Ink-Router-Kit] Cannot remove sequence action "${sequenceActionId}": action not registered.`,
      );
    }
    sequenceOperationsRef.current.delete(sequenceActionId);
  }, []);

  const clearSequenceOperations = useCallback(() => {
    sequenceOperationsRef.current.clear();
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
      defineSequenceAction,
      addSequenceAction,
      hasSequenceAction,
      removeSequenceAction,
      modifySequenceAction,
      clearSequenceOperations,
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
      defineSequenceAction,
      addSequenceAction,
      hasSequenceAction,
      removeSequenceAction,
      modifySequenceAction,
      clearSequenceOperations,
      pushOwner,
      popOwner,
      boundSequence,
      enableWildcardPriority,
    ],
  );

  useInput((input, key) => {
    const ctx = buildPipelineContext(input, key, {
      pathRef,
      globalKeysRef,
      globalSequencesRef,
      activeOverlayIdsRef,
      displayedOverlaysRef,
      layersRef,
      globalPendingSeqRef,
      wildcardPriorityCountRef,
      notifyFocusChange,
    });
    runPipeline(ctx);
  });

  return (
    <KeyboardContext.Provider value={value}>
      {children}
    </KeyboardContext.Provider>
  );
}
