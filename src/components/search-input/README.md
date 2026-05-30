# SearchInput

A search input field built on top of `TextInput`. Provides a 🔍 icon, clear-on-Escape behavior, and a ╳ indicator when the field has content.

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
  SearchInput,
} from '@baigao_h/ink-kit';

function App() {
  const [query, setQuery] = useState('');

  return (
    <Box flexDirection="column">
      <SearchInput
        focusId="search"
        value={query}
        onChange={setQuery}
        placeholder="Search..."
        onSubmit={(v) => console.log('Submitted:', v)}
      />
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
| `focusId` | `string` | (required) | Focus identifier for the keyboard system |
| `value` | `string` | (required) | Current input value |
| `onChange` | `(value: string) => void` | (required) | Called when the value changes |
| `placeholder` | `string` | — | Placeholder text shown when empty |
| `onSubmit` | `(value: string) => void` | — | Called when Enter is pressed |

## Keyboard Bindings

| Key | Action |
|-----|--------|
| Any character | Insert at cursor position |
| `←` / `→` | Move cursor |
| `Backspace` | Delete character to the left |
| `Delete` | Delete character to the right |
| `Enter` | Submit (if `onSubmit` is provided) |
| `Esc` | Clear the input value |
| `Tab` | Move focus to next input |
| `Shift+Tab` | Move focus to previous input |

## Examples

### Simple search

```tsx
const [q, setQ] = useState('');
<SearchInput
  focusId="search"
  value={q}
  onChange={setQ}
  placeholder="Search users..."
/>
```

### With submit handler

```tsx
<SearchInput
  focusId="search"
  value={query}
  onChange={setQuery}
  placeholder="Type and press Enter..."
  onSubmit={(val) => fetchResults(val)}
/>
```

## Notes

- Internally wraps `TextInput` for cursor management, character input, and clipboard paste handling.
- `Esc` calls `onChange('')` to clear the value — independent of any `onSubmit` handler.
- The ╳ indicator is purely visual (grey, shown when `value` is non-empty).
- Must be used inside `<ScenarioManagementProvider>` + `<KeyboardProvider>`.

## License

MIT
