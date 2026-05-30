import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  KeyboardProvider,
} from '../../index.js';
import { NumberInput } from '../../components/number-input/NumberInput.js';
import { Divider } from '../../components/divider/Divider.js';
import { KeyHint } from '../../components/key-hint/KeyHint.js';

function Demo() {
  const [age, setAge] = useState(25);
  const [score, setScore] = useState(500);
  const [volume, setVolume] = useState(50);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>NumberInput 组件演示</Text>
      <Text dimColor>Tab 切换焦点，↑/↓ 或 ←/→ 调整值</Text>

      <Box flexDirection="column" marginTop={1} gap={1}>
        <Box>
          <Text>年龄 (0-150, step=1): </Text>
          <NumberInput focusId="age" value={age} onChange={setAge} min={0} max={150} />
        </Box>
        <Box>
          <Text>分数 (0-999, step=10): </Text>
          <NumberInput focusId="score" value={score} onChange={setScore} min={0} max={999} step={10} />
        </Box>
        <Box>
          <Text>音量 (0-100, step=5): </Text>
          <NumberInput focusId="volume" value={volume} onChange={setVolume} min={0} max={100} step={5} />
        </Box>
      </Box>

      <Divider />

      <Box flexDirection="column">
        <Text>当前值:</Text>
        <Text>age={age}  score={score}  volume={volume}</Text>
      </Box>

      <Divider />

      <KeyHint keys={[
        { key: '↑ or →', desc: '增加' },
        { key: '↓ or ←', desc: '减少' },
        { key: 'Tab', desc: '切换焦点' },
      ]} />
    </Box>
  );
}

registerComponent(Demo, {});

render(
  <ScenarioManagementProvider defaultScreen={Demo}>
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  </ScenarioManagementProvider>,
);
