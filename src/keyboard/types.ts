import type { Key } from "ink";

/**
 * Keyboard callback, matching Ink's `useInput` signature.
 *
 * @param input  The raw character string (empty for special keys).
 * @param key    The key descriptor (booleans for special keys, modifiers).
 */
export type KeyHandler = (input: string, key: Key) => void;

/**
 * Options for {@link KeyboardContextValue.boundKeyboard}.
 */
export interface BoundKeyboardOptions {
  onlyThis?: boolean;
  /**
   * When `true`, the binding only activates when the owning screen is the
   * top of the stack and no overlay is open. Otherwise the binding is
   * ignored and the key continues to bubble down * Associate this binding with a named focus target on the current screen.
   *
   * Focus targets receive events only when they are the active target on
   * their screen layer. Multiple focus targets on the same screen are
   * navigated via Tab / Shift+Tab or programmatic `focusSet` / `focusNext`.
   *
   * When omitted, the binding is stored at the screen level and always
   * evaluated after the active focus target (if any).
   */
  focusId?: string;
}

/**
 * A single key-binding entry stored on a screen layer or focus target.
 */
export interface BoundKeyEntry {
  /** Normalized key names to match. */
  keys: string[];
  /** Handler to invoke on match. */
  handler: KeyHandler;
  /** Whether this binding requires the owner to be stack top. */
  onlyThis: boolean;
  /** The screen component that owns this binding. */
  owner: React.ComponentType<any>;
}

/**
 * Keyboard state for a single named focus target on a screen layer.
 *
 * Focus targets allow multiple form controls on the same screen to have
 * independent key bindings. Only the currently active target receives
 * events; inactive targets are skipped.
 */
export interface FocusTarget {
  /** Registered key bindings (evaluation order). */
  bindings: BoundKeyEntry[];
  /** Keys marked as transparent on this target (pass-through). */
  blockedKeys: string[];
  /** Keys stopped on this target (propagation barrier). */
  stoppedKeys: string[];
}

/**
* It is used to record the registered Actions of each layer for the convenience of subsequent function processing
* For example, the Action masking function of the stop method needs to know which Keys of the historical Screen Level have registered which Actions.
*/
export interface ActionTarget{
  /**
  * Which corresponding Keys are registered for this action
  * An Action may be registered with multiple keys, so it needs to be an array.
  */
  keys: string[];
  /**
  * .Corresponding Action
  */
  action: string;
}

/**
 * Per-layer keyboard state: bindings, transparent keys, stop keys,
 * and focus targets.
 */
export interface ScreenKeyboardLayer {
  /** Registered screen-level key bindings (evaluation order). */
  bindings: BoundKeyEntry[];
  /** Keys marked as transparent at the screen level (pass-through). */
  blockedKeys: string[];
  /** Keys stopped at the screen level (propagation barrier). */
  stoppedKeys: string[];
  /** Keys from globalKeys that this layer has overridden. */
  globalKeyOverrides: Set<string>;

  /** Named focus targets on this layer. */
  focusTargets: Map<string, FocusTarget>;
  /** Registration order of focus target ids. */
  focusOrder: string[];
  /** The currently active focus target id, or null. */
  currentFocusId: string | null;

  actionTargets: ActionTarget[];
}

/**
 * Options for {@link KeyboardContextValue.stop} when stopping keys
 * within a specific focus target.
 */
export interface StopOptions {
  /** If provided, stops only within the named focus target. */
  focusId?: string;
}

/**
 * Options for {@link KeyboardContextValue.blockedKey} when marking keys
 * as transparent within a specific focus target.
 */
export interface BlockedKeyOptions {
  /** If provided, blocks only within the named focus target. */
  focusId?: string;
}

/**
 * A single global key definition.
 *
 * Global keys fire regardless of the screen stack (subject to
 * `category` whitelist and `affectOverlay` placement).
 */
export interface GlobalKeyEntry {
  /**
   * Key name(s) to match.
   *
   * Supports single string or array. Uses the same normalized key-name
   * format as `boundKeyboard` (`"s"`, `"ctrl+q"`, `"return"`, etc.).
   */
  key: string | string[];

  /** Callback to invoke when the key is pressed.
   * It can also be a string, which is used to directly invoke an operation
   */
  operate: (() => void) | string;

  /**
   * Whether screen components are allowed to override this global key
   * via `boundKeyboard`. Defaults to `true`.
   *
   * When `false`, calling `boundKeyboard` with the same key while the
   * current screen is in the global key's `category` whitelist will
   * throw a runtime error.
   */
  cover?: boolean;

  /**
   * Whether this global key fires before the overlay layer.
   *
   * - `false` (default): Overlay → global key → screen stack
   * - `true`:            Global key → overlay → screen stack
   */
  affectOverlay?: boolean;

  /**
   * Whitelist of screen components that may use this global key.
   *
   * - `"*"` or omitted: all screens
   * - `[]`: no screens (effectively disabled)
   * - `[Menu, Game]`: only when the stack top is exactly Menu or Game
   */
  category?: React.ComponentType<any>[] | "*";
}

/**
 * Type definition for shortcut
 */
export interface ShortcutOperationEntry {
  /**
   * Unique identification of the shortcut
   * Used to get an operation and so on.
   */
  actionId: string;
  /**
   * What does calling a shortcut trigger
   */
  action: () => void;
}
