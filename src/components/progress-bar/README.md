# ProgressBar

A simple terminal progress bar component. Pure render — no state or side effects.

## Install

```bash
npm install @baigao_h/ink-kit
```

## Quick Start

```tsx
import React from 'react';
import { Box, Text, render } from 'ink';
import { ProgressBar } from '@baigao_h/ink-kit';

function Demo() {
  return (
    <Box flexDirection="column">
      <ProgressBar percent={65} />
      <ProgressBar percent={100} color="green" />
    </Box>
  );
}

render(<Demo />);
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `percent` | `number` | `0` | Progress value (0–100). Clamped automatically. |
| `width` | `number` | `20` | Total character width of the bar |
| `color` | `string` | `'cyan'` | Bar color (Ink color string) |
| `showPercent` | `boolean` | `true` | Whether to display the numeric percentage |
| `char` | `string` | `'█'` | Filled segment character |
| `emptyChar` | `string` | `'░'` | Empty segment character |

## Examples

### Custom colors

```tsx
<ProgressBar percent={42} color="green" />
<ProgressBar percent={85} color="yellow" />
<ProgressBar percent={100} color="green" />
```

### Wider bar

```tsx
<ProgressBar percent={30} width={40} />
```

### Percentage hidden

```tsx
<ProgressBar percent={50} showPercent={false} />
```

### Custom characters

```tsx
<ProgressBar percent={70} char="■" emptyChar="·" />
```

### Animated (with React state)

```tsx
function AnimatedProgress() {
  const [pct, setPct] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setPct((p) => (p >= 100 ? 0 : p + 2));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return <ProgressBar percent={pct} />;
}
```

## Notes

- `percent` is clamped to `[0, 100]`. Negative values display as 0%, values over 100 display as 100%.
- The component is fully controlled — state management is left to the parent.

## License

MIT
