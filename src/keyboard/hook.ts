import { useContext, useEffect, useState } from "react";
import { KeyboardContext, KeyboardContextValue } from "./context.js";
import { OverlayContext } from "../screen/OverlayContext.js";

/**
 * Access the keyboard API from within a React component.
 *
 * Returns `{ boundKeyboard, blockedKey, stop, globalKeys, ... }`.
 *
 * When called inside an overlay component (wrapped in OverlayContext.Provider),
 * keyboard bindings are automatically isolated to the overlay's own layer,
 * keyed by overlay ID. This enables multiple instances of the same component
 * to coexist as separate overlays with independent keyboard state.
 *
 * Must be used inside a {@link KeyboardProvider}.
 *
 * @throws If no provider is found in the component tree.
 */
export function useKeyboard(): KeyboardContextValue {
  const ctx = useContext(KeyboardContext);
  const overlayId = useContext(OverlayContext);

  if (!ctx) {
    throw new Error(
      "[Ink-Router-Kit] useKeyboard() must be called inside a <KeyboardProvider>.",
    );
  }

  // Manage the owner stack for overlay isolation.
  // When inside an overlay, push the overlay ID as the current owner so
  // that boundKeyboard, blockedKey, stop, and focus functions operate on
  // the overlay's own keyboard layer instead of the screen's layer.
  useEffect(() => {
    if (overlayId) {
      ctx._pushOwner(overlayId);
      return () => {
        ctx._popOwner(overlayId);
      };
    }
    return;
  }, [overlayId, ctx._pushOwner, ctx._popOwner]);

  return ctx;
}

/**
 * Subscribe to the focus state of a named focus target.
 *
 * Returns `true` when the target with the given `focusId` is the currently
 * active focus target on the current screen layer, `false` otherwise.
 *
 * Re-renders the component when the focus target changes (via Tab,
 * `focusSet`, `focusNext`, `focusPrev`, or `focusUnregister`).
 *
 * @param focusId The focus target id to watch.
 * @returns Whether the named target is currently focused.
 */
export function useFocusState(focusId: string): boolean {
  const { focusCurrent, subscribeFocus } = useKeyboard();
  const [isFocused, setIsFocused] = useState<boolean>(
    () => focusCurrent() === focusId,
  );

  useEffect(() => {
    return subscribeFocus(() => {
      setIsFocused(focusCurrent() === focusId);
    });
  }, [focusId, focusCurrent, subscribeFocus]);

  return isFocused;
}
