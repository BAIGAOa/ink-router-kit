import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Text } from 'ink';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { CurrentScreen } from '../../screen/current-screen.js';
import { KeyboardProvider } from '../../keyboard/provider.js';
import { SearchInput } from '../../components/search-input/SearchInput.js';

const KEYS = {
  escape: '\x1b',
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

function renderSearchInput(props: {
  focusId: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  onSubmit?: (v: string) => void;
}) {
  const onChange = props.onChange ?? vi.fn();
  const onSubmit = props.onSubmit ?? vi.fn();

  function HostScreen() {
    return React.createElement(SearchInput, {
      focusId: props.focusId,
      value: props.value ?? '',
      onChange,
      placeholder: props.placeholder,
      onSubmit,
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

  return { lastFrame, lastFrameClean: () => stripAnsi(lastFrame()), stdin, unmount, onChange, onSubmit };
}

beforeEach(() => {
  clearRegistry();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SearchInput', () => {
  it('渲染空值时的占位符', async () => {
    const { lastFrameClean } = renderSearchInput({
      focusId: 'search',
      value: '',
      placeholder: 'Search...',
    });
    await flush();
    const output = lastFrameClean();
    expect(output).toContain('Search');
  });

  it('有值时显示文本和 ╳', async () => {
    const { lastFrameClean } = renderSearchInput({
      focusId: 'search',
      value: 'hello',
    });
    await flush();
    const output = lastFrameClean();
    expect(output).toContain('hello');
    expect(output).toContain('╳');
  });

  it('Esc 清空值', async () => {
    const onChange = vi.fn();
    const { stdin } = renderSearchInput({
      focusId: 'search',
      value: 'hello',
      onChange,
    });
    await flush();

    await press(stdin, KEYS.escape);
    await flush();

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('空值时 Esc 不报错', async () => {
    const onChange = vi.fn();
    const { stdin } = renderSearchInput({
      focusId: 'search',
      value: '',
      onChange,
    });
    await flush();

    await press(stdin, KEYS.escape);
    await flush();

    expect(onChange).toHaveBeenCalledWith('');
  });
});
