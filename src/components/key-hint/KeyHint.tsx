import React from 'react';
import { Box, Text } from 'ink';

interface HintEntry {
  key: string;
  desc: string;
}

interface KeyHintProps {
  keys: HintEntry[];
}

export function KeyHint({ keys }: KeyHintProps) {
  return (
    <Box gap={2}>
      {keys.map(({ key, desc }) => (
        <Box key={key}>
          <Text color="yellow">[{key}]</Text>
          <Text dimColor> {desc}</Text>
        </Box>
      ))}
    </Box>
  );
}
