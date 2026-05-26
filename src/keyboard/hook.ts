import { useContext, useEffect, useState } from "react";
import { KeyboardContext, KeyboardContextValue } from "./context.js";

/**
 * Access the keyboard API from within a React component.
 *
 * Returns `{ boundKeyboard, blockedKey, stop, globalKeys }`.
 *
 * Must be used inside a {@link KeyboardProvider}.
 *
 * @throws If no provider is found in the component tree.
 */
export function useKeyboard(): KeyboardContextValue {
  const ctx = useContext(KeyboardContext);
  if (!ctx) {
    throw new Error(
      "[Ink-Router-Kit] useKeyboard() must be called inside a <KeyboardProvider>.",
    );
  }
  return ctx;
}

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
