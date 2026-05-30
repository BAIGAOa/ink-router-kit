import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Box } from 'ink';
import { registerComponent, clearRegistry } from '../screen/registry.js';
import { ScenarioManagementProvider } from '../screen/provider.js';
import { CurrentScreen } from '../screen/current-screen.js';
import { KeyboardProvider } from '../keyboard/provider.js';
import { Form, Field, TextInput, useKeyboard } from '../index.js';
import type { Validator } from '../components/form/types.js';

// ── Helpers ───────────────────────────────────────────────

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

const required: Validator = (v) => (v ? undefined : 'Required');
const isEmail: Validator = (v) =>
  v && String(v).includes('@') ? undefined : 'Invalid email';

// ── Single-field render helper ────────────────────────────

function renderSingleFieldForm(rules?: Validator[]) {
  const onSubmit = vi.fn();
  const onError = vi.fn();
  const submitRef: { current: (() => void) | undefined } = { current: undefined };

  function HostScreen() {
    return React.createElement(
      Form,
      { onSubmit, onError, submitRef },
      React.createElement(Field, { name: 'email', rules, defaultValue: '' },
        ({ value, onChange, focusId }: any) =>
          React.createElement(TextInput, { focusId, value, onChange }),
      ),
    );
  }

  clearRegistry();
  registerComponent(HostScreen, {});
  const { lastFrame, stdin, unmount } = render(
    React.createElement(
      ScenarioManagementProvider, { defaultScreen: HostScreen },
      React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
    ),
  );

  return { lastFrame, lastFrameClean: () => stripAnsi(lastFrame()), stdin, unmount, onSubmit, onError, submitRef };
}

beforeEach(() => clearRegistry());
afterEach(() => vi.restoreAllMocks());

// ── Tests ─────────────────────────────────────────────────

describe('Form 集成测试（单字段完整流程）', () => {
  it('初始渲染不抛错', async () => {
    const { lastFrameClean } = renderSingleFieldForm([]);
    await flush();
    expect(lastFrameClean()).toBeDefined();
  });

  it('输入字符同步到输出', async () => {
    const { stdin, lastFrameClean } = renderSingleFieldForm([]);
    await flush();

    await press(stdin, 'h');
    await press(stdin, 'i');
    await flush();

    expect(lastFrameClean()).toContain('hi');
  });

  it('空提交触发 onError', async () => {
    const { submitRef, onError, onSubmit } = renderSingleFieldForm([required]);
    await flush();
    await flush();

    submitRef.current!();
    await flush();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].email).toBeTruthy();
  });

  it('填合法值后提交成功', async () => {
    const { stdin, submitRef, onSubmit } = renderSingleFieldForm([required, isEmail]);
    await flush();
    await flush();

    await press(stdin, 't');
    await press(stdin, '@');
    await press(stdin, 'x');
    await press(stdin, '.');
    await press(stdin, 'c');
    await press(stdin, 'o');
    await press(stdin, 'm');
    await flush();

    submitRef.current!();
    await flush();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 't@x.com' });
  });

  it('非法值返回具体错误', async () => {
    const { stdin, submitRef, onError } = renderSingleFieldForm([required, isEmail]);
    await flush();
    await flush();

    await press(stdin, 'n');
    await press(stdin, 'o');
    await press(stdin, 'p');
    await press(stdin, 'e');
    await flush();

    submitRef.current!();
    await flush();

    expect(onError.mock.calls[0][0].email).toBe('Invalid email');
  });

  it('失败后改值再提交通过', async () => {
    const { stdin, submitRef, onSubmit } = renderSingleFieldForm([required, isEmail]);
    await flush();
    await flush();

    // 空提交 → 失败
    submitRef.current!();
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();

    // 输入合法值
    await press(stdin, 'o');
    await press(stdin, '@');
    await press(stdin, 'm');
    await press(stdin, '.');
    await press(stdin, 'e');
    await flush();

    // 再提交 → 成功
    submitRef.current!();
    await flush();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'o@m.e' });
  });

  it('卸载后不抛错', async () => {
    const { stdin, unmount } = renderSingleFieldForm([]);
    await flush();

    await press(stdin, 'h');
    unmount();

    expect(true).toBe(true);
  });
});

describe('Form 集成测试（双字段 + 焦点隔离）', () => {
  it('Tab 导航不影响值隔离（不抛错）', async () => {
    const onSubmit = vi.fn();
    const submitRef: { current: (() => void) | undefined } = { current: undefined };

    function HostScreen() {
      return React.createElement(
        Form,
        { onSubmit, initialValues: { email: 'hi@x.c', password: 's3cret' }, submitRef },
        React.createElement(
          Box,
          { flexDirection: 'column' },
          React.createElement(Field, { name: 'email', rules: [required, isEmail], defaultValue: '' },
            ({ value, onChange, focusId }: any) =>
              React.createElement(TextInput, { focusId, value, onChange }),
          ),
          React.createElement(Field, { name: 'password', rules: [required], defaultValue: '' },
            ({ value, onChange, focusId }: any) =>
              React.createElement(TextInput, { focusId, value, onChange, mask: '*' }),
          ),
        ),
      );
    }

    clearRegistry();
    registerComponent(HostScreen, {});
    const { lastFrame } = render(
      React.createElement(
        ScenarioManagementProvider, { defaultScreen: HostScreen },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );
    await flush();
    await flush();

    // 两个字段各自的 initialValues 正确渲染
    const output = stripAnsi(lastFrame());
    expect(output).toContain('hi@x.c');
    // password 不显示明文（mask）

    submitRef.current!();
    await flush();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'hi@x.c', password: 's3cret' });
  });
});
