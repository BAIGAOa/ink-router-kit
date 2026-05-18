import React from 'react';
import { Box } from 'ink';
import { useScreenSystem } from './hook.js';

/**
 * Render the current screen and any active overlay.
 *
 * When no overlay is open only the top-of-stack screen is rendered.
 * When an overlay is open both the underlying screen and the overlay
 * are rendered together (overlay on top).
 */
export function CurrentScreen(): React.ReactNode {
  const { currentScreen, currentOverlay } = useScreenSystem();

  // 无 overlay：直接返回屏幕元素
  if (!currentOverlay) {
    return currentScreen as React.ReactElement;
  }

  // 有 overlay：屏幕在底层，overlay 覆盖在上层
  return React.createElement(Box, { flexDirection: 'column', width: '100%', height: '100%' },
    currentScreen as React.ReactElement,
    currentOverlay as React.ReactElement,
  );
}