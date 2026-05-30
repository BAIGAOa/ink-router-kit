# Badge

A colored label / tag component for terminal UIs. Uses Ink's `backgroundColor` to render a filled badge.

## Install

```bash
npm install @baigao_h/ink-kit
```

## Quick Start

```tsx
import React from 'react';
import { Box, Text, render } from 'ink';
import { Badge } from '@baigao_h/ink-kit';

function Demo() {
  return (
    <Box>
      <Badge color="green">Success</Badge>
      <Badge color="red">Error</Badge>
      <Badge color="yellow">Warning</Badge>
    </Box>
  );
}

render(<Demo />);
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `string` | (required) | Text displayed inside the badge |
| `color` | `string` | `'cyan'` | Background color (Ink color string) |

## Examples

### Status badges

```tsx
<Badge color="green">Passed</Badge>
<Badge color="red">Failed</Badge>
<Badge color="yellow">Pending</Badge>
```

### Multiple badges in a row

```tsx
<Box>
  <Badge color="cyan">Info</Badge>
  <Badge color="blue">API</Badge>
  <Badge color="magenta">Beta</Badge>
</Box>
```

## License

MIT
