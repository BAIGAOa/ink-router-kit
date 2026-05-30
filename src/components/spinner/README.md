# Spinner

A lightweight animated spinner component for Ink applications. Pure visual — no state management, no keyboard integration.

## Install

```bash
npm install @baigao_h/ink-kit
```

## Quick Start

```tsx
import React from 'react';
import { Box, Text, render } from 'ink';
import { Spinner } from '@baigao_h/ink-kit';

function Demo() {
  return (
    <Box>
      <Spinner label="Loading..." />
    </Box>
  );
}

render(<Demo />);
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `SpinnerType` | `'dots'` | Animation preset |
| `label` | `string` | — | Text displayed after the spinning character |
| `color` | `string` | — | Text color (Ink color string, e.g. `'cyan'`, `'green'`) |
| `speed` | `number` | `80` | Frame interval in milliseconds |
| `active` | `boolean` | `true` | When `false`, stops at the first frame |

## Animation Types

| Type | Frames | Preview |
|------|--------|---------|
| `dots` | `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` | Classic braille spinner |
| `line` | `─━─━─━─━` | Horizontal line pulse |
| `simple` | `\|/-\` | Minimal rotating bar |
| `triangle` | `◢◣◤◥` | Rotating triangle |
| `arc` | `◜◝◞◟` | Rotating arc |

## Examples

### With label and color

```tsx
<Spinner type="dots" color="green" label="Processing..." />
```

### Static (no animation)

```tsx
<Spinner active={false} label="Done!" color="green" />
```

### Custom speed

```tsx
<Spinner type="simple" speed={200} label="Working slowly..." />
```

### Without label

```tsx
<Spinner />
```

## Notes

- Component unmount automatically clears the internal `setInterval`.
- `active={false}` does not unmount the spinner — it simply freezes on the first frame, useful for transition from "loading" to "done".
- When `type` is invalid (e.g. a typo), falls back to `dots`.

## License

MIT
