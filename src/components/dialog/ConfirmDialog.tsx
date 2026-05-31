import React, { useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { useKeyboard, useFocusState } from '../../keyboard/hook.js';
import type { ConfirmDialogProps } from './types.js';

/**
 * A modal confirmation dialog with two buttons.
 *
 * Designed to be displayed via {@link overlay}:
 *
 * ```tsx
 * registerComponent(ConfirmDialog, {});
 * overlay(ConfirmDialog, {
 *   title: 'delete',
 *   message: 'continue?',
 *   onConfirm: () => { deleteItem(); closeOverlay(); },
 *   onCancel: () => closeOverlay(),
 * });
 * ```
 *
 * Keyboard:
 * - Tab / Shift+Tab — switch between buttons
 * - Enter — trigger focused button
 * - Esc — cancel
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { boundKeyboard, focusSet, focusUnregister } = useKeyboard();
  const confirmFocused = useFocusState('dialog-confirm');
  const cancelFocused = useFocusState('dialog-cancel');

  // Keep stable refs so the keyboard effect doesn't capture stale callbacks
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    // Esc 在任何按钮上都是取消（屏幕级绑定，不受 focus 影响）
    const unEsc = boundKeyboard(['escape'], () => onCancelRef.current());

    const unConfirm = boundKeyboard(
      ['return'],
      () => onConfirmRef.current(),
      { focusId: 'dialog-confirm' },
    );

    const unCancel = boundKeyboard(
      ['return'],
      () => onCancelRef.current(),
      { focusId: 'dialog-cancel' },
    );

    focusSet('dialog-confirm');

    return () => {
      unEsc();
      unConfirm();
      unCancel();
      focusUnregister('dialog-confirm');
      focusUnregister('dialog-cancel');
    };
  }, []);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text bold color="yellow">
          {'⚠ ' + title}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>{message}</Text>
      </Box>

      <Box justifyContent="flex-end" gap={2}>
        <Box>
          <Text
            color={cancelFocused ? 'cyan' : 'grey'}
            bold={cancelFocused}
            underline={cancelFocused}
          >
            {cancelLabel}
          </Text>
        </Box>

        <Box>
          <Text
            color={confirmFocused ? 'green' : 'grey'}
            bold={confirmFocused}
            underline={confirmFocused}
          >
            {confirmLabel}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
