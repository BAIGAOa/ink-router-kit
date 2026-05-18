import { useContext } from 'react';
import { KeyboardContext, KeyboardContextValue } from './context.js';

/**
 * Access the keyboard API from within a React component.
 *
 * Returns `{ boundKeyboard, blockedKey, stop }`.
 *
 * Must be used inside a {@link KeyboardProvider}.
 *
 * @throws If no provider is found in the component tree.
 */
export function useKeyboard(): KeyboardContextValue {
  const ctx = useContext(KeyboardContext);
  if (!ctx) {
    throw new Error(
      '[Ink-Trc] useKeyboard() 必须在 <KeyboardProvider> 内部使用。',
    );
  }
  return ctx;
}