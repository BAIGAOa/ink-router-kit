import { createContext } from "react";
import type {
  KeyHandler,
  BoundKeyboardOptions,
  BlockedKeyOptions,
  StopOptions,
  GlobalKeyEntry,
} from "./types.js";

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
  blockedKey: (keys: string[], options?: BlockedKeyOptions) => void;

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
   * Calling this replaces any previously registered global keys.
   *
   * @param entries  Array of global key definitions.
   */
  globalKeys: (entries: GlobalKeyEntry[]) => void;

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
   * No-op if no focus target with the given id exists on the current
   * screen layer.
   *
   * @param focusId  The focus target id to activate.
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
}

/**
 * React context for the keyboard system.
 *
 * Accessed via {@link useKeyboard}. Must be provided by a
 * {@link KeyboardProvider} nested inside a
 * {@link ScenarioManagementProvider}.
 */
export const KeyboardContext = createContext<KeyboardContextValue | null>(null);
