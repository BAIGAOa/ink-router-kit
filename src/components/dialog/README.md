# ConfirmDialog

A modal confirmation dialog with two buttons (confirm / cancel), designed to be displayed via the **overlay system**. Integrates with the ink‑kit keyboard and focus system.

## Quick Start

1. **Register** the dialog so it can be used with `overlay()`:

```tsx
import { registerComponent, ConfirmDialog } from '@baigao_h/ink-kit';

registerComponent(ConfirmDialog, {
  title: '',
  message: '',
  onConfirm: () => {},
  onCancel: () => {},
});
```

2. **Show the dialog** from any screen or module:

```tsx
import { overlay, closeOverlay } from '@baigao_h/ink-kit';

overlay(ConfirmDialog, {
  title: t('confirm.title'),
  message: t('confirm.message'),
  confirmLabel: t('confirm.ok'),
  cancelLabel: t('confirm.cancel'),
  onConfirm: () => {
    // user confirmed
    closeOverlay();
  },
  onCancel: () => {
    // user cancelled
    closeOverlay();
  },
});
```

## Props

| Prop           | Type         | Required | Default | Description                                        |
| -------------- | ------------ | :------: | ------- | -------------------------------------------------- |
| `title`        | `string`     | ✅       | –       | Dialog title, shown prominently at the top.       |
| `message`      | `string`     | ✅       | –       | Body message explaining what the user is confirming. |
| `confirmLabel` | `string`     | ❌       | `'确认'` | Label of the confirm (rightmost) button.          |
| `cancelLabel`  | `string`     | ❌       | `'取消'` | Label of the cancel (left) button.                |
| `onConfirm`    | `() => void` | ✅       | –       | Called when the user confirms (Enter on confirm button). |
| `onCancel`     | `() => void` | ✅       | –       | Called when the user cancels (Enter on cancel button or Esc). |

## Keyboard Shortcuts

| Key                | Action                                          |
| ------------------ | ----------------------------------------------- |
| `Tab`              | Move focus between confirm and cancel buttons. |
| `Shift+Tab`        | Move focus in reverse direction.               |
| `Enter`            | Activate the currently focused button.         |
| `Escape`           | Cancel the dialog (calls `onCancel`).          |

- The dialog opens with focus on the **confirm** button.
- `Esc` triggers cancellation regardless of which button is focused.

## Focus System Integration

`ConfirmDialog` internally uses `useFocusState` to track which button is focused:

- Two focus targets are registered: `dialog-confirm` and `dialog-cancel`.
- The built‑in `Tab` / `Shift+Tab` navigation (handled by `KeyboardProvider`) automatically cycles between them.
- When the dialog unmounts, both focus targets are unregistered automatically.

No additional focus configuration is needed – just register the component and call `overlay()`.

## Working with Overlay System

`ConfirmDialog` is meant to be used **exclusively** with `overlay()`:

- It is **not** a screen component and should not be registered with a `parent`.
- Opening the dialog adds it on top of the current screen stack without changing `currentPath`.
- Closing the dialog (via `closeOverlay()` or the built‑in `Esc` handler) removes it and restores keyboard control to the underlying screen.

**Typical pattern inside a screen component:**

```tsx
import { overlay, closeOverlay, ConfirmDialog } from '@baigao_h/ink-kit';

function Editor() {
  const { boundKeyboard } = useKeyboard();
  const [dirty, setDirty] = useState(true);

  useEffect(() => {
    boundKeyboard(['escape'], () => {
      if (dirty) {
        overlay(ConfirmDialog, {
          title: 'Discard changes?',
          message: 'You have unsaved changes. Are you sure you want to exit?',
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
          onConfirm: () => process.exit(0),
          onCancel: () => closeOverlay(),
        });
      } else {
        process.exit(0);
      }
    });
  }, [dirty]);

  return <Text>Editing…</Text>;
}
```

## Visual Appearance

The dialog uses Ink’s `Box` with a yellow rounded border. Its internal layout is fixed:

- Title (bold yellow, prefixed with `⚠`)
- Message text
- Two buttons (cancel on the left, confirm on the right) displayed at the bottom‑right.

Button styling changes when focused:
- **Cancel button**: cyan text, bold, underlined when focused; grey otherwise.
- **Confirm button**: green text, bold, underlined when focused; grey otherwise.

> Currently the appearance cannot be customised through props. If you need a different style, you can copy the component and modify it directly.

## Full Example

```tsx
import React, { useEffect } from 'react';
import { render, Box, Text } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  KeyboardProvider,
  overlay,
  closeOverlay,
  ConfirmDialog,
} from '@baigao_h/ink-kit';

registerComponent(ConfirmDialog, {
  title: '',
  message: '',
  onConfirm: () => {},
  onCancel: () => {},
});

function MainScreen() {
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    boundKeyboard(['x'], () => {
      overlay(ConfirmDialog, {
        title: 'Exit?',
        message: 'Do you really want to quit?',
        onConfirm: () => process.exit(0),
        onCancel: () => closeOverlay(),
      });
    });
  }, []);

  return (
    <Box flexDirection="column">
      <Text>Press X to show confirmation dialog</Text>
    </Box>
  );
}

registerComponent(MainScreen, {});

render(
  <ScenarioManagementProvider defaultScreen={MainScreen}>
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  </ScenarioManagementProvider>
);
```

