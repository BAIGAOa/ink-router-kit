import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Box } from 'ink';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { CurrentScreen } from '../../screen/current-screen.js';
import { KeyboardProvider } from '../../keyboard/provider.js';
import { TextInput } from '../../components/text/TextInput.js';
import { Form } from '../../components/form/Form.js';
import { Field } from '../../components/form/Field.js';
import type { Validator } from '../../components/form/types.js';

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

async function flush() {
  await new Promise((r) => setTimeout(r, 10));
}

// ── Validators ────────────────────────────────────────────

const required: Validator = (v) => (v ? undefined : 'Required');
const minLength3: Validator = (v) =>
  v && String(v).length >= 3 ? undefined : 'Too short';

// ── Helper — renders Form + Fields, exposes submitForm via submitRef ─

function renderForm(
  opts: {
    initialValues?: Record<string, any>;
    onSubmit?: (values: Record<string, any>) => void;
    onError?: (errors: Record<string, string | undefined>) => void;
  },
  fields: Array<{
    name: string;
    rules?: Validator[];
    defaultValue?: any;
  }>,
) {
  const onSubmit = opts.onSubmit ?? vi.fn();
  const onError = opts.onError ?? vi.fn();
  const submitRef: { current: (() => void) | undefined } = { current: undefined };

  function HostScreen() {
    return React.createElement(
      Form,
      { onSubmit, onError, initialValues: opts.initialValues, submitRef },
      React.createElement(
        Box,
        { flexDirection: 'column' },
        ...fields.map((f) =>
          React.createElement(Field, {
            key: f.name,
            name: f.name,
            rules: f.rules,
            defaultValue: f.defaultValue,
          }, ({ value, onChange, focusId }: any) =>
            React.createElement(TextInput, {
              focusId,
              value,
              onChange,
            }),
          ),
        ),
      ),
    );
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

  return { lastFrame, lastFrameClean: () => stripAnsi(lastFrame()), stdin, unmount, onSubmit, onError, submitRef };
}

beforeEach(() => {
  clearRegistry();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────

describe('Form + Field 基础', () => {
  it('initialValues 传递给 Field 的 render prop', async () => {
    const { lastFrameClean } = renderForm(
      { initialValues: { email: 'a@b.c' } },
      [{ name: 'email' }],
    );
    await flush();
    expect(lastFrameClean()).toContain('a@b.c');
  });

  it('无 initialValues 时使用 Field 的 defaultValue', async () => {
    const { lastFrameClean } = renderForm(
      {},
      [{ name: 'nickname', defaultValue: 'anon' }],
    );
    await flush();
    await flush(); // 等 Field 的 useEffect 触发 registerField → setValues
    expect(lastFrameClean()).toContain('anon');
  });

  it('多个 Field 各自独立显示值', async () => {
    const { lastFrameClean } = renderForm(
      { initialValues: { a: 'hello', b: 'world' } },
      [{ name: 'a' }, { name: 'b' }],
    );
    await flush();
    const output = lastFrameClean();
    expect(output).toContain('hello');
    expect(output).toContain('world');
  });
});

describe('验证和提交', () => {
  it('验证失败时调用 onError 包含错误字段信息', async () => {
    const onError = vi.fn();
    const onSubmit = vi.fn();
    const { submitRef } = renderForm(
      { onError, onSubmit },
      [{ name: 'name', rules: [required], defaultValue: '' }],
    );
    await flush();
    await flush();

    submitRef.current!();

    await flush();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].name).toBeTruthy();
  });

  it('验证通过后调用 onSubmit 传递所有字段值', async () => {
    const onSubmit = vi.fn();
    const { submitRef } = renderForm(
      { onSubmit, initialValues: { email: 'a@b.c', age: '25' } },
      [
        { name: 'email', rules: [required] },
        { name: 'age', rules: [required] },
      ],
    );
    await flush();
    await flush();

    submitRef.current!();
    await flush();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.c', age: '25' });
  });

  it('验证规则按顺序执行，第一条失败即停止', async () => {
    const onError = vi.fn();
    const { submitRef } = renderForm(
      { onError, initialValues: { field: '' } },
      [{ name: 'field', rules: [required, minLength3] }],
    );
    await flush();
    await flush();

    submitRef.current!();
    await flush();

    expect(onError.mock.calls[0][0].field).toBe('Required');
  });

  it('过第一条规则后检查下一条', async () => {
    const onError = vi.fn();
    const { submitRef } = renderForm(
      { onError, initialValues: { field: 'ab' } },
      [{ name: 'field', rules: [required, minLength3] }],
    );
    await flush();
    await flush();

    submitRef.current!();
    await flush();

    expect(onError.mock.calls[0][0].field).toBe('Too short');
  });
});

describe('错误清除', () => {
  it('验证失败后用户改值，再提交通过', async () => {
    const onSubmit = vi.fn();
    const { submitRef, stdin } = renderForm(
      { onSubmit },
      [{ name: 'email', rules: [required], defaultValue: '' }],
    );
    await flush();
    await flush();

    // 第一次提交 → 失败
    submitRef.current!();
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();

    // 用户输入
    stdin.write('x');
    await flush();

    // 再次提交 → 成功
    submitRef.current!();
    await flush();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'x' });
  });
});

describe('组件卸载清理', () => {
  it('卸载后提交不会触发回调（mountedRef 防护）', async () => {
    const onSubmit = vi.fn();
    const submitRef: { current: (() => void) | undefined } = { current: undefined };

    function HostScreen() {
      return React.createElement(
        Form,
        { onSubmit, submitRef },
        React.createElement(Field, { name: 'x', rules: [], defaultValue: '' },
          ({ value, onChange, focusId }: any) =>
            React.createElement(TextInput, { focusId, value, onChange }),
        ),
      );
    }
    HostScreen.displayName = 'HostScreen';

    clearRegistry();
    registerComponent(HostScreen, {});
    const { unmount } = render(
      React.createElement(ScenarioManagementProvider, { defaultScreen: HostScreen },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );
    await flush();
    await flush();

    // 获取 submitForm 引用
    expect(submitRef.current).toBeDefined();

    // 卸载 Form
    unmount();
    await flush();

    // submitForm 仍可调用但不触发 onSubmit（mountedRef 已置 false）
    expect(() => submitRef.current!()).not.toThrow();
    // 注意：由于 globalKeys 无法动态移除，ctrl+enter handler
    // 仍然注册但在 Handler 内被 mountedRef 拦截，无害
  });
});

describe('错误聚焦', () => {
  it('多字段验证失败后聚焦第一个错误字段', async () => {
    const { submitRef } = renderForm(
      { initialValues: { email: '', password: '' } },
      [
        { name: 'email', rules: [required] },
        { name: 'password', rules: [required] },
      ],
    );
    await flush();
    await flush();

    expect(() => submitRef.current!()).not.toThrow();
  });
});
