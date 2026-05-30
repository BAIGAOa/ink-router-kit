import React, { useEffect } from 'react';
import { Text } from 'ink';
import { useKeyboard, useFocusState } from '../../keyboard/index.js';

interface NumberInputProps {
  focusId: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberInput({
  focusId,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
}: NumberInputProps) {
  const isFocused = useFocusState(focusId);
  const { boundKeyboard, focusUnregister } = useKeyboard();

  useEffect(() => {
    const up = boundKeyboard(['up', 'right'], () => {
      const next = Math.min(value + step, max);
      if (next !== value) onChange(next);
    }, { focusId });

    const down = boundKeyboard(['down', 'left'], () => {
      const next = Math.max(value - step, min);
      if (next !== value) onChange(next);
    }, { focusId });

    return () => {
      up();
      down();
      focusUnregister(focusId);
    };
  }, [focusId, value, min, max, step, onChange]);

  const text = isFocused ? `${value}█` : String(value);

  return <Text>{text}</Text>;
}
