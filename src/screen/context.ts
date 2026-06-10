import { createContext, ReactNode } from 'react';
import type {
  SkipFn,
  BackFn,
  GotoScreenFn,
  OpenOverlayFn,
  CloseOverlayFn,
  CloseAllOverlaysFn,
  ActivateOverlayFn,
  DeactivateOverlayFn,
  OverlayEntry,
} from './types.js';

/**
 * Value provided by {@link ScenarioManagementProvider} via React context.
 *
 * Includes the current screen, all active overlays, navigation functions,
 * and overlay management functions for the multi-overlay system.
 */
export interface ScreenSystemContextValue {
  /** The rendered React element for the current (top-of-stack) screen. */
  currentScreen: ReactNode;
  /** Rendered React elements for all overlays, sorted by zIndex ascending. */
  currentOverlays: ReactNode[];
  /** Full navigation path from root to the current screen. */
  currentPath: React.ComponentType<any>[];
  /** Navigate down the tree to a direct child of the current screen. */
  skip: SkipFn;
  /** Navigate up the tree toward the root. */
  back: BackFn;
  /** Jump to any registered screen across branches via LCA resolution. */
  gotoScreen: GotoScreenFn;
  /** Open a new overlay with a unique ID. Multiple overlays can coexist. */
  openOverlay: OpenOverlayFn;
  /** Close a specific overlay by its ID. */
  closeOverlay: CloseOverlayFn;
  /** Close all open overlays at once. */
  closeAllOverlays: CloseAllOverlaysFn;
  /** Activate an overlay so it receives keyboard events. */
  activateOverlay: ActivateOverlayFn;
  /** Deactivate an overlay so it stops receiving keyboard events. */
  deactivateOverlay: DeactivateOverlayFn;
  /** IDs of overlays that are currently active (receiving keyboard events). */
  activeOverlayIds: string[];
  /** All currently displayed overlays with metadata (id, zIndex, etc.). */
  displayedOverlays: OverlayEntry[];
}

/**
 * React context for the screen navigation system.
 *
 * Accessed via {@link useScreenSystem}. Must be provided by a
 * {@link ScenarioManagementProvider} at the root of the component tree.
 */
export const ScreenSystemContext =
  createContext<ScreenSystemContextValue | null>(null);
