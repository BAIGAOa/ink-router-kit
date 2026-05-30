import React from 'react';
import { Text } from 'ink';

interface DividerProps {
  label?: string;
  char?: string;
  width?: number;
}

export function Divider({ label, char = '─', width = 50 }: DividerProps) {
  if (label) {
    const side = Math.max(0, Math.floor((width - label.length - 2) / 2));
    const line = char.repeat(side) + ` ${label} ` + char.repeat(side);
    return <Text dimColor>{line}</Text>;
  }

  return <Text dimColor>{char.repeat(width)}</Text>;
}
