# KeyHint

A shortcut key hint bar — renders a row of `[key] description` pairs. Use it to show available keyboard shortcuts at the bottom of a screen.

## Install

```bash
npm install @baigao_h/ink-kit
```

## Quick Start

```tsx
import React from 'react';
import { Box, render } from 'ink';
import { KeyHint } from '@baigao_h/ink-kit';

function Demo() {
  return (
    <KeyHint
      keys={[
        { key: 's', desc: 'Save' },
        { key: 'q', desc: 'Quit' },
        { key: '?', desc: 'Help' },
      ]}
    />
  );
}

render(<Demo />);
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `keys` | `{ key: string; desc: string }[]` | (required) | Array of key-description pairs to display |

## Examples

### Simple shortcuts

```tsx
<KeyHint keys={[
  { key: 's', desc: 'Start' },
  { key: 'l', desc: 'Load' },
  { key: 'q', desc: 'Quit' },
]} />
```

### With modifier keys

```tsx
<KeyHint keys={[
  { key: 'ctrl+s', desc: 'Save' },
  { key: 'ctrl+z', desc: 'Undo' },
  { key: 'ctrl+shift+p', desc: 'Publish' },
]} />
```

### Single hint

```tsx
<KeyHint keys={[{ key: '?', desc: 'Help' }]} />
```

## Notes

- Key names are displayed in yellow, descriptions in dim color.
- Pairs are separated by a 2-character gap.
- This is a pure presentation component — it does not register any keyboard bindings. Use it alongside `useKeyboard().boundKeyboard()` / `globalKeys()` for actual key handling.

## License

MIT
