import React from 'react';
import { Box, Text } from 'ink';

interface BadgeProps {
  children: string;
  color?: string;
}

export function Badge({ children, color = 'cyan' }: BadgeProps) {
  return (
    <Box marginRight={1}>
      <Text backgroundColor={color} color="black">
        {' '}{children}{' '}
      </Text>
    </Box>
  );
}
