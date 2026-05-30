import React from 'react';
import { Text } from 'ink';

interface ProgressBarProps {
  percent?: number;
  width?: number;
  color?: string;
  showPercent?: boolean;
  char?: string;
  emptyChar?: string;
}

export function ProgressBar({
  percent = 0,
  width = 20,
  color = 'cyan',
  showPercent = true,
  char = '█',
  emptyChar = '░',
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const bar = char.repeat(filled) + emptyChar.repeat(width - filled);
  const content = showPercent ? `[${bar}] ${clamped}%` : `[${bar}]`;

  return <Text color={color}>{content}</Text>;
}
