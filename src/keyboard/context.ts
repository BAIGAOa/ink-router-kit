import { createContext } from "react";
import type { KeyHandler, BoundKeyboardOptions } from "./types.js";

export interface KeyboardContextValue {
  /**
   * Bind one or more keys to a handler on the current screen layer.
   *
   * @param keys     Key names to bind (e.g. `["s", "ctrl+q", "return"]`).
   * @param handler  Callback receiving the raw `input` and `key` from Ink.
   * @param options  Optional binding behavior (e.g. `onlyThis`).
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
   * When a transparent key passes through this layer, the layer's own
   * bindings are skipped, and the key continues to propagate to layers
   * below. Use this to let a lower layer handle a key without interference
   * from the current layer.
   *
   * @param keys  Key names to make transparent.
   */
  blockedKey: (keys: string[]) => void;
  /**
   * Prevent one or more keys from propagating to layers below.
   *
   * The stopped keys are "consumed" at the current layer: they do NOT
   * reach any lower layer. The current layer's own bindings are still
   * evaluated before the stop takes effect, so local bindings work
   * normally. This is useful for preventing accidental activation of
   * background-layer handlers (e.g. preventing `q` from reaching a
   * menu-layer "quit" handler while in-game).
   *
   * Only has effect when the calling layer is the top of the stack
   * (or the active overlay layer).
   *
   * @param keys  Key names to stop from propagating.
   * @returns     An unstop function that removes the keys from the stop list.
   */
  stop: (keys: string[]) => () => void;
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null);
