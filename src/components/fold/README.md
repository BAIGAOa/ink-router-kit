# Fold

A collapsible panel component integrated with the ink-kit keyboard and focus system.

## Install

```bash
npm install @baigao_h/ink-kit
```

## Quick Start

```tsx
import React from 'react';
import { Box, Text, render } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  KeyboardProvider,
  Fold,
  TextInput,
} from '@baigao_h/ink-kit';

function App() {
  return (
    <Fold
      focusId="settings"
      label="Advanced Settings"
      preview={<Text dimColor>Click to expand...</Text>}
    >
      <Box flexDirection="column" gap={1} marginTop={1}>
        <Text bold>Server:</Text>
        <TextInput focusId="server" value="" onChange={() => {}} />
      </Box>
    </Fold>
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

## Visual States

```
Folded (focused)                    Folded (unfocused)
┌─────────────────┐                ┌─────────────────┐
│ ▼ Settings      │                │ ▶ Settings      │
│ Click to expand.│                │ Click to expand.│
└─────────────────┘                └─────────────────┘

Expanded
┌─────────────────┐
│ ▼ Settings      │
│ ┌─────────────┐ │
│ │ Server: ... │ │  ← children content
│ └─────────────┘ │
└─────────────────┘
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `focusId` | `string` | ✅ | — | Focus target for the header bar. |
| `label` | `string` | ✅ | — | Text shown in the header bar. |
| `preview` | `ReactNode` | ❌ | — | Content shown when folded (under the label). |
| `children` | `ReactNode` | ✅ | — | Content shown when expanded. |
| `expanded` | `boolean` | ❌ | — | Controlled: expanded state. |
| `onToggle` | `() => void` | ❌ | — | Controlled: called when the user toggles. |
| `defaultExpanded` | `boolean` | ❌ | `false` | Uncontrolled: initial expanded state. |

## Keyboard

| Key | Action | Context |
|-----|--------|---------|
| `Space` | Toggle fold / unfold | Fold header focus target |
| `Tab` | Move focus to next target (into content) | KeyboardProvider (built-in) |
| `Shift+Tab` | Move focus to previous target | KeyboardProvider (built-in) |

## Focus System Integration

- The header bar registers a focus target via `focusId`
- When **focused**: ▶/▼ indicator is cyan; when unfocused: grey
- `Space` only toggles when the header is the active focus target
- Expanding reveals children content — any focus targets inside (TextInputs, etc.) become reachable via `Tab`
- Collapsing hides children — their focus targets are removed from the keyboard layer

## Examples

### With preview text

```tsx
<Fold
  focusId="advanced"
  label="Advanced"
  preview={<Text dimColor>Name: Alice · Level: 7</Text>}
>
  <SelectInput focusId="level" items={levels} />
</Fold>
```

### Uncontrolled (simple)

```tsx
<Fold focusId="fold" label="Details">
  <Text>Extra details here...</Text>
</Fold>
```

### Controlled

```tsx
function App() {
  const [open, setOpen] = useState(false);
  return (
    <Fold
      focusId="fold"
      label="Details"
      expanded={open}
      onToggle={() => setOpen(!open)}
    >
      <Text>Toggle via code or keyboard</Text>
    </Fold>
  );
}
```

### Multiple folds on one screen

```tsx
<Box flexDirection="column">
  <Fold focusId="fold-1" label="Section A">
    <TextInput focusId="a-field" value="" onChange={() => {}} />
  </Fold>
  <Fold focusId="fold-2" label="Section B">
    <NumberInput focusId="b-field" value={0} onChange={() => {}} />
  </Fold>
</Box>
```

Press `Tab` to cycle through all fold headers and their content inputs.

## License

MIT
