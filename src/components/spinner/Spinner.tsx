import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

const FRAMES: Record<string, string[]> = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['─', '━', '─', '━', '─', '━', '─', '━'],
  simple: ['|', '/', '-', '\\'],
  triangle: ['◢', '◣', '◤', '◥'],
  arc: ['◜', '◝', '◞', '◟'],
};

export type SpinnerType = keyof typeof FRAMES;

interface SpinnerProps {
  type?: SpinnerType;
  label?: string;
  color?: string;
  speed?: number;
  active?: boolean;
}

export function Spinner({
  type = 'dots',
  label,
  color,
  speed = 80,
  active = true,
}: SpinnerProps) {
  const [index, setIndex] = useState(0);
  const frames = FRAMES[type] ?? FRAMES.dots;

  useEffect(() => {
    if (!active || frames.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % frames.length);
    }, speed);

    return () => clearInterval(timer);
  }, [active, speed, frames.length]);

  const displayIndex = active ? index : 0;
  const content = label ? `${frames[displayIndex]} ${label}` : frames[displayIndex];

  return <Text color={color}>{content}</Text>;
}
