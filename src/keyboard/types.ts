import type { Key } from 'ink';

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
  /**
   * When `true`, the binding only activates when the owning screen is the
   * top of the stack and no overlay is open. Otherwise the binding is
   * ignored and the key continues to bubble down.
   */
  onlyThis?: boolean;
}

/**
 * A single key-binding entry stored on a screen layer.
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
 * Per-layer keyboard state: bindings, transparent keys, and stop keys.
 */
export interface ScreenKeyboardLayer {
  /** Registered key bindings (evaluation order). */
  bindings: BoundKeyEntry[];
  /** Keys marked as transparent on this layer (pass-through). */
  blockedKeys: string[];
  /** Keys stopped on this layer (propagation barrier). */
  stoppedKeys: string[];
  /** Keys from globalKeys that this layer has overridden (only set when cover=true). */
  globalKeyOverrides: Set<string>;
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

  /** Callback to invoke when the key is pressed. */
  operate: () => void;

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
  category?: React.ComponentType<any>[] | '*';
}