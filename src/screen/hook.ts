import { useContext } from 'react';
import { ScreenSystemContext, ScreenSystemContextValue } from './context.js';

/**
 * Access the screen-management API from within a React component.
 *
 * Returns `{ currentScreen, currentOverlay, currentPath, skip, back,
 * gotoScreen, overlay, closeOverlay }`.
 *
 * Must be used inside a {@link ScenarioManagementProvider}.
 *
 * @throws If no provider is found in the component tree.
 */
export function useScreenSystem(): ScreenSystemContextValue {
  const ctx = useContext(ScreenSystemContext);
  if (!ctx) {
    throw new Error(
      '[Ink-Router-Kit] useScreenSystem() must be called inside a <ScenarioManagementProvider>.',
    );
  }
  return ctx;
}