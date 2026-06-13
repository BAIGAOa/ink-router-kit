import { createContext } from "react";
import type {
  KeyHandler,
  BoundKeyboardOptions,
  BlockedKeyOptions,
  StopOptions,
  GlobalKeyEntry,
  GlobalSequenceEntry,
  ShortcutOperationEntry,
  SequenceOptions,
} from "./types.js";

/**
 * Type for the owner stack used to track overlay context.
 * Can be a component type (for screens) or a string (for overlay IDs).
 */
export type LayerOwner = React.ComponentType<any> | string;

/**
 * Value provided by {@link KeyboardProvider} via React context.
 */
export interface KeyboardContextValue {
  /**
   * Bind one or more keys to a handler on the current screen layer.
   *
   * When a `focusId` is provided, the binding is stored on a named focus
   * target instead of the screen-level bucket. Only the currently active
   * focus target receives events.
   *
   * @param keys     Key names to bind (e.g. `["s", "ctrl+q", "return"]`).
   * @param handler  Callback receiving the raw `input` and `key` from Ink.
   * @param options  Optional binding behavior (`onlyThis`, `focusId`).
   * @returns        An unbind function that removes this binding when called.
   */
  boundKeyboard: (
    keys: string[],
    handler: KeyHandler,
    options?: BoundKeyboardOptions,
  ) => () => void;

  /**
   * Mark one or more keys as "transparent" on the current layer.
   *
   * When a transparent key reaches this layer (or the named focus target),
   * the layer's own bindings are skipped and the key continues to propagate
   * to layers below.
   *
   * @param keys     Key names to make transparent.
   * @param options  If `focusId` is provided, marks transparent only
   *                 within that focus target.
   */
  blockedKey: (keys: string[], options?: BlockedKeyOptions) => () => void;

  /**
   * Prevent one or more keys from propagating to layers below.
   *
   * Stopped keys are consumed at this layer: local bindings are evaluated
   * first, and if no binding matches, the key is blocked from reaching
   * lower layers.
   *
   * @param keys     Key names to stop from propagating.
   * @param options  If `focusId` is provided, stops only within that
   *                 focus target.
   * @returns        An unstop function that removes the keys from the
   *                 stop list.
   */
  stop: (keys: string[], options?: StopOptions) => () => void;

  /**
   * Register global key bindings.
   *
   * Global keys fire independently of the screen stack (subject to
   * `category` whitelist and `affectOverlay` placement).
   *
   * By default (or with `{ mode: 'replace' }`), replaces all previously
   * registered global keys. Pass `{ mode: 'add' }` to append without
   * removing existing entries.
   *
   * @param entries  Array of global key definitions.
   * @param options  Optional: `{ mode: 'replace' | 'add' }`. Default `'replace'`.
   */
  globalKeys: (
    entries: GlobalKeyEntry[],
    options?: { mode?: "replace" | "add" },
  ) => void;

  /**
   * Register global sequence key bindings.
   *
   * Global sequences fire independently of the screen stack with higher
   * priority than {@link globalKeys}. They match multi-key sequences
   * instead of single key presses.
   *
   * By default (or with `{ mode: 'replace' }`), replaces all previously
   * registered global sequences. Pass `{ mode: 'add' }` to append without
   * removing existing entries.
   *
   * **Priority chain**: global sequences are evaluated before global keys
   * in both the `affectOverlay: true` and `affectOverlay: false` stages:
   *   1. globalSequence(affectOverlay:true)
   *   2. globalKeys(affectOverlay:true)
   *   3. overlay layer
   *   4. globalSequence(affectOverlay:false)
   *   5. globalKeys(affectOverlay:false)
   *   6. screen stack
   *
   * **Cover**: Only `boundSequence` can override a global sequence (not
   * `boundKeyboard`). When `cover: false`, `boundSequence` with the same
   * first key throws.
   *
   * **No `times` support**: Unlike `globalKeys`, global sequences do not
   * support the `times` option.
   *
   * @param entries  Array of global sequence definitions.
   * @param options  Optional: `{ mode: 'replace' | 'add' }`. Default `'replace'`.
   * @throws If any `keys` array has length < 2.
   */
  globalSequence: (
    entries: GlobalSequenceEntry[],
    options?: { mode?: "replace" | "add" },
  ) => void;

  /**
   * Remove a focus target from the current screen layer.
   *
   * If the removed target was the currently active one, the next target
   * (in registration order) is activated automatically. If no targets
   * remain, `currentFocusId` becomes `null`.
   *
   * Components should call this in their `useEffect` cleanup alongside
   * unbinding their focus-level key bindings.
   *
   * @param focusId  The focus target id to remove.
   */
  focusUnregister: (focusId: string) => void;

  /**
   * Activate a specific focus target by its id.
   *
   * Throws a runtime error if the current screen has no keyboard layer
   * or no focus target with the given id is registered.
   *
   * @param focusId  The focus target id to activate.
   * @throws If the current screen has no keyboard layer or the focus
   *         target does not exist.
   */
  focusSet: (focusId: string) => void;

  /**
   * Activate the next focus target in registration order.
   *
   * Equivalent to pressing Tab. Wraps around to the first target if
   * the last target is currently active.
   */
  focusNext: () => void;

  /**
   * Activate the previous focus target in registration order.
   *
   * Equivalent to pressing Shift+Tab. Wraps around to the last target
   * if the first target is currently active.
   */
  focusPrev: () => void;

  /**
   * Return the currently active focus target id on the current screen.
   *
   * @returns The active focus id, or `null` if no focus targets exist.
   */
  focusCurrent: () => string | null;

  /**
   * Subscribe to focus changes on the current screen layer.
   *
   * The listener is called whenever the active focus id changes (via
   * Tab, `focusSet`, `focusNext`, `focusPrev`, or `focusUnregister`).
   *
   * @param listener  Callback invoked on focus change.
   * @returns         An unsubscribe function.
   */
  subscribeFocus: (listener: () => void) => () => void;

  /**
   * Register named shortcut actions that can be referenced by key bindings
   * using a string identifier instead of an inline callback.
   *
   * Decouples operation definition from key binding.
   *
   * @param entries - Array of shortcut operation definitions.
   *                  Each entry must have a unique `actionId`.
   *
   * @throws {Error} If an `actionId` is duplicated.
   */
  defineShortcutAction: (entries: ShortcutOperationEntry[]) => void;
  /**
   * Dynamically register a single shortcut action.
   *
   * @param entry - The shortcut operation definition to add.
   * @throws {Error} If an action with the same `actionId` already exists.
   */
  addAction: (entry: ShortcutOperationEntry) => void;
  /**
   * Check whether a shortcut action with the given id exists.
   *
   * @param actionId - The action id to look up.
   * @returns `true` if the action is registered, `false` otherwise.
   */
  hasAction: (actionId: string) => boolean;
  /**
   * Remove a registered shortcut action.
   *
   * @param actionId - The action id to remove.
   * @throws {Error} If no action with the given id exists.
   */
  removeAction: (actionId: string) => void;
  /**
   * Modify the default keys of an existing shortcut action.
   *
   * @param actionId - The unique identifier of the action.
   * @param keys     - New key names to replace the previous default keys.
   * @throws If the action does not exist or was not registered with a `keys` field.
   */
  modifyAction: (actionId: string, keys: string[]) => void;
  /**
   * Clear all registered shortcut operations.
   * Primarily used for testing or full keyboard reset scenarios.
   */
  clearShortcutOperations: () => void;

  /**
   * Internal: Push an owner onto the owner stack.
   * Used by useKeyboard() when rendering inside an overlay.
   */
  _pushOwner: (owner: LayerOwner) => void;

  /**
   * Internal: Pop an owner from the owner stack.
   * Used by useKeyboard() cleanup when leaving an overlay context.
   */
  _popOwner: (owner: LayerOwner) => void;

  /**
   * Register a multi-key sequence binding on the current screen layer.
   *
   * When the first key of a sequence is pressed, the layer enters a pending
   * state waiting for subsequent keys within `timeout` milliseconds (default
   * 500). If the full sequence is entered in order before the timeout, the
   * handler fires. Otherwise the pending state is cancelled.
   *
   * **Sequence priority**: Sequences are evaluated before ordinary
   * `boundKeyboard` bindings. When a sequence's first key is pressed, it
   * is consumed by the sequence system and will not trigger any normal
   * binding for that key.
   *
   * **Exclusive vs non-exclusive (default)**: In non-exclusive mode, a
   * key that does NOT match the next expected key in the sequence
   * immediately cancels the pending sequence and falls through to normal
   * bindings. In exclusive mode (`exclusive: true`), mismatched keys are
   * silently consumed — the sequence keeps waiting within its timeout.
   *
   * **Layer isolation**: Each screen / overlay maintains its own pending
   * sequence state. Navigating away, switching focus, or closing an
   * overlay automatically clears any pending sequence on that layer.
   *
   * @param keys      Ordered key names that make up the sequence
   *                  (e.g. `['g', 'g']`, `['c', 'w']`). Length must be ≥ 2.
   * @param handler   Callback invoked when the full sequence is matched.
   *                  Receives the Ink `input` and `key` of the final key
   *                  press that completed the sequence.
   * @param options   Optional configuration:
   *                  - `timeout` (ms, default 500): how long to wait between
   *                    key presses before cancelling the sequence.
   *                  - `exclusive` (default false): if true, mismatched keys
   *                    are consumed silently; if false, they cancel the
   *                    sequence and fall through.
   *                  - `onlyThis` / `focusId`: same behaviour as
   *                    `boundKeyboard`.
   * @returns         An unbind function that removes the sequence binding
   *                   when called.
   *
   * @example
   * ```tsx
   * // Vim-like 'gg' to jump to the top
   * useEffect(() => {
   *   boundSequence(['g', 'g'], () => scrollToTop());
   * }, []);
   *
   * // Exclusive mode: only 'ctrl+w' 'q' triggers, no other key interrupts
   * useEffect(() => {
   *   boundSequence(['ctrl+w', 'q'], closeTab, { exclusive: true });
   * }, []);
   *
   * // Sequence restricted to a specific focus target
   * useEffect(() => {
   *   boundSequence(['d', 'd'], deleteLine, { focusId: 'editor' });
   * }, []);
   * ```
   */
  boundSequence: (
    keys: string[],
    handler: KeyHandler,
    options?: SequenceOptions,
  ) => () => void;

  /**
   * Enable wildcard priority mode.
   *
   * When enabled, wildcard `*` bindings take absolute priority over ALL
   * other key handling — sequences, exact key matches, everything. Only
   * normal character input (as determined by `isNormalCharacter`) is
   * affected — special keys (Tab, Return, Escape, arrow keys, modifiers,
   * etc.) are never matched by wildcard and always fall through to normal
   * processing.
   *
   * Uses reference counting: multiple callers can enable independently.
   * Each returned disable function decrements the count; the mode is
   * disabled when the count reaches zero.
   *
   * @returns A function that, when called, disables wildcard priority
   *          for this caller. When all callers have disabled, original
   *          priority is restored.
   *
   * @example
   * ```tsx
   * useEffect(() => {
   *   const disable = enableWildcardPriority();
   *   const unbind = boundKeyboard(['*'], handleInput, { focusId: 'input' });
   *   return () => { unbind(); disable(); };
   * }, []);
   * ```
   */
  enableWildcardPriority: () => (() => void);
}

/**
 * React context for the keyboard system.
 *
 * Accessed via {@link useKeyboard}. Must be provided by a
 * {@link KeyboardProvider} nested inside a
 * {@link ScenarioManagementProvider}.
 */
export const KeyboardContext = createContext<KeyboardContextValue | null>(null);
