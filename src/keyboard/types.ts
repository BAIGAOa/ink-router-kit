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
}