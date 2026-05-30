# NumberInput

A numeric input component integrated with the ink-kit keyboard and focus system. Arrow keys increment/decrement the value, `Tab` switches focus between inputs.

## Install

```bash
npm install @baigao_h/ink-kit
```

## Quick Start

```tsx
import React, { useState } from 'react';
import { Box, Text, render } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  KeyboardProvider,
  NumberInput,
} from '@baigao_h/ink-kit';

function App() {
  const [age, setAge] = useState(25);

  return (
    <Box flexDirection="column">
      <Text>Age: </Text>
      <NumberInput focusId="age" value={age} onChange={setAge} min={0} max={150} />
    </Box>
  );
}

registerComponent(App, {});

render(
  <ScenarioManagementProvider defaultScreen={App}>
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  </ScenarioManagementProvider>,
);
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `focusId` | `string` | (required) | Focus identifier for the keyboard system. Must be unique on the current screen. |
| `value` | `number` | (required) | Current numeric value |
| `onChange` | `(value: number) => void` | (required) | Called when the value changes |
| `min` | `number` | `-Infinity` | Minimum allowed value |
| `max` | `number` | `Infinity` | Maximum allowed value |
| `step` | `number` | `1` | Increment/decrement step |

## Keyboard Bindings

| Key | Action |
|-----|--------|
| `↑` / `→` | Increment value (clamped to `max`) |
| `↓` / `←` | Decrement value (clamped to `min`) |
| `Tab` | Move focus to next input |
| `Shift+Tab` | Move focus to previous input |

## Examples

### Step by 10

```tsx
<NumberInput
  focusId="score"
  value={score}
  onChange={setScore}
  min={0}
  max={999}
  step={10}
/>
```

### No lower bound

```tsx
<NumberInput
  focusId="temperature"
  value={temp}
  onChange={setTemp}
  max={100}
/>
```

### Multiple inputs on one screen

```tsx
function Settings() {
  const [age, setAge] = useState(25);
  const [volume, setVolume] = useState(50);

  return (
    <Box flexDirection="column">
      <NumberInput focusId="age" value={age} onChange={setAge} min={0} max={150} />
      <NumberInput focusId="volume" value={volume} onChange={setVolume} min={0} max={100} step={5} />
    </Box>
  );
}
```

Press `Tab` to switch between inputs.

## Notes

- `onChange` is only called when the new value is different from the current value (after clamping).
- When focused, the value is displayed with a trailing `█` cursor character.
- The component registers a focus target on mount and unregisters it on unmount.

## License

MIT
