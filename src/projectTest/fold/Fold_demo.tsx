import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  KeyboardProvider,
  useKeyboard,
  Fold,
  TextInput,
  NumberInput,
  Divider,
  KeyHint,
} from '../../index.js';

function Demo() {
  const [name, setName] = useState('');
  const [age, setAge] = useState(25);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>Fold Demo — Game Settings</Text>
      <Text dimColor>Tab to focus · Space to expand/collapse</Text>

      <Box marginTop={1}>
        <Fold
          focusId="player-fold"
          label="Player Info"
          preview={
            <Text dimColor>Name: {name || '(empty)'} · Age: {age}</Text>
          }
        >
          <Box flexDirection="column" gap={1} marginTop={1}>
            <Box>
              <Text bold>Name: </Text>
              <TextInput
                focusId="fold-name"
                value={name}
                onChange={setName}
                placeholder="Player name"
              />
            </Box>
            <Box>
              <Text bold>Age: </Text>
              <NumberInput
                focusId="fold-age"
                value={age}
                onChange={setAge}
                min={1}
                max={99}
              />
            </Box>
          </Box>
        </Fold>
      </Box>

      <Box marginTop={1}>
        <Fold focusId="about-fold" label="About This Game" preview={<Text dimColor>Click to learn more</Text>}>
          <Box flexDirection="column" gap={1} marginTop={1}>
            <Text>Ink-Kit Fold Component Demo</Text>
            <Text dimColor>Each Fold is a collapsible section with:
            </Text>
            <Text dimColor>• Space to toggle expand/collapse</Text>
            <Text dimColor>• Preview text when collapsed</Text>
            <Text dimColor>• Full content when expanded</Text>
            <Text dimColor>• Focus system integration (Tab to navigate)</Text>
          </Box>
        </Fold>
      </Box>

      <Box marginTop={1}>
        <Fold focusId="empty-fold" label="No Preview (empty fold)">
          <Box flexDirection="column" gap={1} marginTop={1}>
            <Text>This fold has no preview prop.</Text>
            <Text dimColor>When collapsed, nothing is shown below the header.</Text>
          </Box>
        </Fold>
      </Box>

      <Divider />

      <KeyHint keys={[
        { key: 'Tab', desc: 'Next section' },
        { key: 'Space', desc: 'Toggle fold' },
        { key: 'q', desc: 'Quit' },
      ]} />
    </Box>
  );
}

registerComponent(Demo, {});

function App() {
  const { boundKeyboard } = useKeyboard();
  React.useEffect(() => {
    boundKeyboard(['q'], () => process.exit(0));
  }, []);
  return <CurrentScreen />;
}

registerComponent(App, {});

render(
  <ScenarioManagementProvider defaultScreen={Demo}>
    <KeyboardProvider>
      <App />
    </KeyboardProvider>
  </ScenarioManagementProvider>,
);
