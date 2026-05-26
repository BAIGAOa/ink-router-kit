import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  KeyboardProvider,
  MultiSelectInput,
  useKeyboard,
} from '../../index.js';

const colorItems = [
  { label: 'Red', value: 'red' },
  { label: 'Green', value: 'green' },
  { label: 'Blue', value: 'blue' },
  { label: 'Yellow', value: 'yellow' },
  { label: 'Cyan', value: 'cyan' },
  { label: 'Magenta', value: 'magenta' },
  { label: 'White', value: 'white' },
  { label: 'Black', value: 'black' },
];

/**
 * 主界面：展示 MultiSelectInput 的受控模式用法。
 * Space 切换选中，Enter 确认提交，Esc 退出。
 */
function MainScreen() {
  const { globalKeys } = useKeyboard();
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<string[] | null>(null);

  // 绑定 Esc 退出（根节点不能 back，直接退出进程）
  useEffect(() => {
    globalKeys([
      {
        key: 'escape',
        operate: () => process.exit(0),
      },
    ]);
  }, [globalKeys]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>🎨 MultiSelectInput Demo</Text>
      <Text dimColor>
        Space: 切换  |  Enter: 确认  |  ↑↓/jk: 移动  |  Esc: 退出
      </Text>

      <Box marginY={1}>
        <MultiSelectInput
          focusId="colors"
          items={colorItems}
          selected={selected}
          onChange={setSelected}
          onSubmit={setSubmitted}
          limit={5}
        />
      </Box>

      <Text>
        已选择: {selected.length > 0 ? selected.join(', ') : '(空)'}
      </Text>

      {submitted && (
        <Box marginTop={1}>
          <Text color="green">
            ✅ 已确认: {submitted.join(', ')}
          </Text>
        </Box>
      )}
    </Box>
  );
}

registerComponent(MainScreen, {});

render(
  <ScenarioManagementProvider defaultScreen={MainScreen}>
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  </ScenarioManagementProvider>,
);
