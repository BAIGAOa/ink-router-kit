import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Text } from 'ink';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { CurrentScreen } from '../../screen/current-screen.js';
import { KeyboardProvider } from '../../keyboard/provider.js';
import { NumberInput } from '../../components/number-input/NumberInput.js';

const KEYS = {
  up: '\x1b[A',
  down: '\x1b[B',
} as const;

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

async function press(stdin: { write: (data: string) => void }, key: string) {
  stdin.write(key);
  await new Promise((r) => setTimeout(r, 10));
}

async function flush() {
  await new Promise((r) => setTimeout(r, 10));
}

function renderNumberInput(props: {
  focusId: string;
  value?: number;
  onChange?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const onChange = props.onChange ?? vi.fn();

  function HostScreen() {
    return React.createElement(NumberInput, {
      focusId: props.focusId,
      value: props.value ?? 0,
      onChange,
      min: props.min,
      max: props.max,
      step: props.step,
    });
  }
  HostScreen.displayName = 'HostScreen';

  clearRegistry();
  registerComponent(HostScreen, {});

  const { lastFrame, stdin, unmount } = render(
    React.createElement(
      ScenarioManagementProvider,
      { defaultScreen: HostScreen },
      React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
    ),
  );

  return { lastFrame, lastFrameClean: () => stripAnsi(lastFrame()), stdin, unmount, onChange };
}

beforeEach(() => {
  clearRegistry();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NumberInput', () => {
  it('渲染初始值', async () => {
    const { lastFrameClean } = renderNumberInput({ focusId: 'num', value: 42 });
    expect(lastFrameClean()).toContain('42');
  });

  it('↑ 键增加值', async () => {
    const { stdin, onChange } = renderNumberInput({ focusId: 'num', value: 5 });
    await flush();

    await press(stdin, KEYS.up);
    await flush();

    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('↓ 键减少值', async () => {
    const { stdin, onChange } = renderNumberInput({ focusId: 'num', value: 5 });
    await flush();

    await press(stdin, KEYS.down);
    await flush();

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('不小于 min', async () => {
    const { stdin, onChange } = renderNumberInput({ focusId: 'num', value: 0, min: 0 });
    await flush();

    await press(stdin, KEYS.down);
    await flush();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('不大于 max', async () => {
    const { stdin, onChange } = renderNumberInput({ focusId: 'num', value: 10, max: 10 });
    await flush();

    await press(stdin, KEYS.up);
    await flush();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('自定义 step', async () => {
    const { stdin, onChange } = renderNumberInput({ focusId: 'num', value: 5, step: 3 });
    await flush();

    await press(stdin, KEYS.up);
    await flush();

    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('聚焦时显示光标', async () => {
    const { lastFrameClean } = renderNumberInput({ focusId: 'num', value: 7 });
    await flush();
    // 聚焦时末尾有 █ 光标
    expect(lastFrameClean()).toContain('7█');
  });
});
