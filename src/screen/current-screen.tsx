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

  // 始终用 Box 包裹，避免 overlay 开关时返回元素类型变化
  // （组件 → Box）导致 React 卸载重挂 组件。组件 重挂载时
  // boundKeyboard 会路由到 overlay layer，导致 overlay 关闭键被屏蔽。
  // null 作为 React 子节点会被忽略，不渲染任何内容。
  return React.createElement(
    Box,
    { flexDirection: 'column', width: '100%', height: '100%' },
    currentScreen as React.ReactElement,
    currentOverlay as React.ReactElement,
  );
}
