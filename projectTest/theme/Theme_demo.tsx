import React, { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';
import { ThemeProvider, useTheme } from '../../src/index.js';

function ThemeDemo() {
  const { color, style, themeId, themes, setTheme } = useTheme();
  const [idx, setIdx] = useState(themes.indexOf(themeId));

  useInput((input, key) => {
    if (key.escape || input === 'q') process.exit(0);
    if (input === 't') {
      const next = (idx + 1) % themes.length;
      setIdx(next);
      setTheme(themes[next]);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Title bar */}
      <Box
        borderStyle="round"
        borderColor={color('border') ?? 'gray'}
        paddingX={2}
      >
        <Text bold={style('titleBold') ?? false} color={color('primary') ?? 'white'}>
          Theme Demo
        </Text>
      </Box>

      {/* Theme info */}
      <Box marginTop={1} flexDirection="column">
        <Text>
          {'  '}
          <Text color={color('primary')}>●</Text>
          {' Active theme: '}
          <Text bold color={color('primary')}>
            {themeId}
          </Text>
        </Text>
        <Text color={color('muted')}>
          {'  Available: '}
          {themes.map((t) => (
            <Text key={t} color={t === themeId ? color('primary') : color('muted')}>
              [{t}]{' '}
            </Text>
          ))}
        </Text>
      </Box>

      {/* Color swatches */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color={color('primary') ?? 'white'}>
          {'  Color Keys'}
        </Text>
        <Text color={color('primary') ?? 'white'}>
          {'    primary → '}
          <Text backgroundColor={color('primary')} color="black">
            {'  '}{color('primary')}{'  '}
          </Text>
        </Text>
        <Text>
          {'    bg      → '}
          <Text backgroundColor={color('bg')} color={color('primary')}>
            {'  '}{color('bg')}{'  '}
          </Text>
        </Text>
        <Text color={color('muted')}>
          {'    muted   → '}{color('muted')}
        </Text>
        <Text color={color('danger')}>
          {'    danger  → '}{color('danger')}
        </Text>
        <Text color={color('success')}>
          {'    success → '}{color('success')}
        </Text>
        <Text>
          {'    border  → '}
          <Text color={color('border')}>{color('border')}</Text>
        </Text>
      </Box>

      {/* Style keys */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color={color('primary') ?? 'white'}>
          {'  Style Keys'}
        </Text>
        <Text bold={style('titleBold') ?? false}>
          {'    titleBold  → '}{String(style('titleBold'))}
        </Text>
        <Text dimColor={style('textDim') ?? false}>
          {'    textDim    → '}{String(style('textDim'))}
        </Text>
        <Text bold={style('borderBold') ?? false}>
          {'    borderBold → '}{String(style('borderBold'))}
        </Text>
      </Box>

      {/* Controls */}
      <Box marginTop={2}>
        <Text dimColor={style('textDim') ?? false} color={color('muted')}>
          [T] Switch theme ({themes.join(', ')})  [Q] Quit
        </Text>
      </Box>
    </Box>
  );
}

render(
  <ThemeProvider path="./projectTest/theme" defaultTheme="dark">
    <ThemeDemo />
  </ThemeProvider>,
);
