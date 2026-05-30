import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  KeyboardProvider,
} from '../../index.js';
import { SearchInput } from '../../components/search-input/SearchInput.js';
import { Divider } from '../../components/divider/Divider.js';
import { KeyHint } from '../../components/key-hint/KeyHint.js';

function Demo() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>SearchInput 组件演示</Text>

      <Box flexDirection="column" marginTop={1} gap={1}>
        <Box>
          <Text>搜索: </Text>
          <SearchInput
            focusId="search"
            value={query}
            onChange={setQuery}
            placeholder="Type to search..."
            onSubmit={(v) => setSubmitted(v)}
          />
        </Box>
      </Box>

      <Divider />

      <Box flexDirection="column">
        <Text>当前输入: [{query}]</Text>
        <Text>已提交: [{submitted}]</Text>
      </Box>

      <Divider />

      <KeyHint keys={[
        { key: 'Esc', desc: '清空' },
        { key: 'Enter', desc: '提交' },
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
