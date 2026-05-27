/**
 * Props for the ConfirmDialog component.
 *
 * A modal confirmation dialog with two buttons (confirm / cancel),
 * designed to be shown via the overlay system.
 */
export interface ConfirmDialogProps {
  /** Dialog title, displayed prominently at the top. */
  readonly title: string;

  /** Body message explaining what the user is confirming. */
  readonly message: string;

  /** Label for the confirm (rightmost) button. @default "确认" */
  readonly confirmLabel?: string;

  /** Label for the cancel (left) button. @default "取消" */
  readonly cancelLabel?: string;

  /** Called when the user confirms (Enter on confirm button). */
  readonly onConfirm: () => void;

  /** Called when the user cancels (Enter on cancel button or Esc). */
  readonly onCancel: () => void;
}
