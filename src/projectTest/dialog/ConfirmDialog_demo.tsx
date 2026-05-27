import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  KeyboardProvider,
  ConfirmDialog,
  useScreenSystem,
  useKeyboard,
  closeOverlay,
} from '../../index.js';

function MainScreen() {
  const { boundKeyboard, globalKeys } = useKeyboard();
  const { overlay: showOverlay } = useScreenSystem();
  const [dirty, setDirty] = useState(true);

  useEffect(() => {
    globalKeys([
      {
        key: 'escape',
        operate: () => {
          if (dirty) {
            showOverlay(ConfirmDialog, {
              title: '放弃更改',
              message: '你有未保存的更改，确定要退出吗？',
              confirmLabel: '放弃并退出',
              cancelLabel: '继续编辑',
              onConfirm: () => process.exit(0),
              onCancel: () => closeOverlay(),
            });
          } else {
            process.exit(0);
          }
        },
      },
    ]);

    const unbindS = boundKeyboard(['s'], () =>
      setDirty((prev) => !prev),
    );

    return () => {
      unbindS();
    };
  }, [dirty]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Editor</Text>
      <Text dimColor>
        Esc: exit | S: toggle dirty (now: {dirty ? 'unsaved' : 'saved'})
      </Text>
      <Box marginTop={1}>
        <Text>Editing...</Text>
      </Box>
    </Box>
  );
}

registerComponent(MainScreen, {});
registerComponent(ConfirmDialog, {
  title: '',
  message: '',
  onConfirm: () => {},
  onCancel: () => {},
});

render(
  <ScenarioManagementProvider defaultScreen={MainScreen}>
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  </ScenarioManagementProvider>,
);
