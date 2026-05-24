import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React, { useState } from 'react';

import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { CurrentScreen } from '../../screen/current-screen.js';
import { KeyboardProvider } from '../../keyboard/provider.js';
import { TextInput, UncontrolledTextInput } from '../../components/text/TextInput.js';

// ── 按键常量 ─────────────────────────────────────────────
// 通过 stdin.write() 写入终端转义序列来模拟按键。
// Ink 的 useInput 从 stdin 读取后解析为 (input, key) 对。

const KEYS = {
  enter:     '\r',
  escape:    '\x1b',
  backspace: '\x7f',
  tab:       '\t',
  up:        '\x1b[A',
  down:      '\x1b[B',
  right:     '\x1b[C',
  left:      '\x1b[D',
  delete:    '\x1b[3~',
} as const;

// ── 辅助函数 ─────────────────────────────────────────────

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** 向 stdin 写入按键序列，然后等一个微任务让 React 处理 */
async function press(stdin: { write: (data: string) => void }, key: string) {
  stdin.write(key);
  await new Promise((r) => setTimeout(r, 10));
}

/** 连续输入一串普通字符 */
async function type(stdin: { write: (data: string) => void }, chars: string) {
  for (const ch of chars) {
    stdin.write(ch);
    await new Promise((r) => setTimeout(r, 10));
  }
}

// ── Render 辅助 ──────────────────────────────────────────
//
// 每个测试注册独立的 screen 组件，在其中渲染 TextInput。
// 链路：ScenarioManagementProvider → KeyboardProvider → CurrentScreen
//       → HostScreen（注册后）→ TextInput
//
// KeyboardProvider 中的 useInput 从 ink-testing-library 提供的
// 虚拟 stdin 读取，stdin.write() 直接驱动整个键盘分发链。

function renderTextInput(props: {
  focusId: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  placeholder?: string;
  mask?: string;
  showCursor?: boolean;
  highlightPastedText?: boolean;
}) {
  function HostScreen() {
    return React.createElement(TextInput, props as any);
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

  return {
    lastFrame,
    lastFrameClean: () => stripAnsi(lastFrame()),
    stdin,
    unmount,
  };
}

function renderUncontrolled(props: {
  focusId: string;
  initialValue?: string;
  onSubmit?: (v: string) => void;
  placeholder?: string;
  mask?: string;
  showCursor?: boolean;
  highlightPastedText?: boolean;
}) {
  function HostScreen() {
    return React.createElement(UncontrolledTextInput, props as any);
  }
  HostScreen.displayName = 'HostScreenUncontrolled';

  clearRegistry();
  registerComponent(HostScreen, {});

  const { lastFrame, stdin, unmount } = render(
    React.createElement(
      ScenarioManagementProvider,
      { defaultScreen: HostScreen },
      React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
    ),
  );

  return {
    lastFrame,
    lastFrameClean: () => stripAnsi(lastFrame()),
    stdin,
    unmount,
  };
}


beforeEach(() => {
  clearRegistry();
});

afterEach(() => {
  vi.restoreAllMocks();
});


describe('基础渲染', () => {
  it('有值时渲染 value 文本', () => {
    const { lastFrameClean } = renderTextInput({
      focusId: 'inp',
      value: 'hello',
      onChange: () => {},
    });
    expect(lastFrameClean()).toContain('hello');
  });

  it('空值 + 聚焦时渲染 placeholder（首字符反色）', () => {
    const { lastFrameClean } = renderTextInput({
      focusId: 'inp',
      value: '',
      onChange: () => {},
      placeholder: 'Enter name',
    });
    const output = lastFrameClean();
    expect(output).toContain('E');
    expect(output).toContain('nter name');
  });

  it('空值 + 无 placeholder 时只显示光标', () => {
    const { lastFrameClean } = renderTextInput({
      focusId: 'inp',
      value: '',
      onChange: () => {},
    });
    // 剥离 ANSI 后只剩反色空格 → trim 后为空
    expect(lastFrameClean().trim()).toBe('');
  });

  it('showCursor=false 时不渲染光标符号', () => {
    const { lastFrameClean } = renderTextInput({
      focusId: 'inp',
      value: 'hi',
      onChange: () => {},
      showCursor: false,
    });
    expect(lastFrameClean()).toBe('hi');
  });
});


describe('字符输入', () => {
  it('普通字符触发 onChange 并拼接', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'ab',
      onChange,
    });

    await press(stdin, 'c');
    expect(onChange).toHaveBeenCalledWith('abc');

    await press(stdin, 'd');
    expect(onChange).toHaveBeenCalledWith('abd');
  });

  it('光标在中间时插入到正确位置', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'ac',
      onChange,
    });

    // 初始光标在末尾（2），左移一次到位置 1
    await press(stdin, KEYS.left);
    await press(stdin, 'b');

    expect(onChange).toHaveBeenCalledWith('abc');
  });
});


describe('删除操作', () => {
  it('backspace 删除光标前一个字符', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'hello',
      onChange,
    });

    await press(stdin, KEYS.backspace);
    expect(onChange).toHaveBeenCalledWith('hell');
  });

  it('光标在位置 0 时 backspace 是空操作', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'hi',
      onChange,
    });

    // 光标移到开头
    await press(stdin, KEYS.left);
    await press(stdin, KEYS.left);

    onChange.mockClear();
    await press(stdin, KEYS.backspace);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('delete 删除光标后一个字符', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'hello',
      onChange,
    });

    // 光标移到开头
    await press(stdin, KEYS.left);
    await press(stdin, KEYS.left);
    await press(stdin, KEYS.left);
    await press(stdin, KEYS.left);
    await press(stdin, KEYS.left);

    await press(stdin, KEYS.delete);
    expect(onChange).toHaveBeenCalledWith('ello');
  });

  it('光标在末尾时 delete 是空操作', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'hi',
      onChange,
    });

    onChange.mockClear();
    await press(stdin, KEYS.delete);
    expect(onChange).not.toHaveBeenCalled();
  });
});


describe('光标移动', () => {
  it('左/右箭头不触发 onChange', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'hello',
      onChange,
    });

    onChange.mockClear();
    await press(stdin, KEYS.left);
    await press(stdin, KEYS.right);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('光标不能左移超出 0', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'a',
      onChange,
    });

    await press(stdin, KEYS.left); // 1 → 0
    // 再左移不应抛错
    await expect(press(stdin, KEYS.left)).resolves.not.toThrow();
  });

  it('光标不能右移超出 length', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'a',
      onChange,
    });

    // 已在末尾，右移不抛错
    await expect(press(stdin, KEYS.right)).resolves.not.toThrow();
  });

  it('showCursor=false 时光标移动不抛错', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'hello',
      onChange,
      showCursor: false,
    });

    await expect(press(stdin, KEYS.left)).resolves.not.toThrow();
    await expect(press(stdin, KEYS.right)).resolves.not.toThrow();
  });
});


describe('提交（onSubmit）', () => {
  it('按 enter 触发 onSubmit，传递当前 value', async () => {
    const onSubmit = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'done',
      onChange: () => {},
      onSubmit,
    });

    await press(stdin, KEYS.enter);
    expect(onSubmit).toHaveBeenCalledWith('done');
  });

  it('未传 onSubmit 时按 enter 不抛错', async () => {
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'x',
      onChange: () => {},
    });

    await expect(press(stdin, KEYS.enter)).resolves.not.toThrow();
  });
});


describe('掩码模式（mask）', () => {
  it('渲染时用掩码字符替代真实 value', () => {
    const { lastFrameClean } = renderTextInput({
      focusId: 'inp',
      value: 'secret',
      onChange: () => {},
      mask: '*',
    });

    expect(lastFrameClean()).not.toContain('secret');
    expect(lastFrameClean()).toContain('******');
  });

  it('onChange 仍传递真实值', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'abc',
      onChange,
      mask: '*',
    });

    await press(stdin, 'd');
    expect(onChange).toHaveBeenCalledWith('abcd');
  });
});


describe('外部 value 收缩', () => {
  it('外部缩短 value 时光标不越界', async () => {
    let shrink!: () => void;

    function HostScreen() {
      const [v, setV] = useState('hello');
      shrink = () => setV('hi');
      return React.createElement(TextInput, {
        focusId: 'inp',
        value: v,
        onChange: (nv: string) => setV(nv),
      });
    }
    HostScreen.displayName = 'ShrinkHost';

    clearRegistry();
    registerComponent(HostScreen, {});

    const { lastFrameClean } = render(
      React.createElement(
        ScenarioManagementProvider,
        { defaultScreen: HostScreen },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );

    // 初始光标在末尾（5）
    expect(lastFrameClean()).toContain('hello');

    // 外部收缩 value: "hello" → "hi"
    shrink();
    await new Promise((r) => setTimeout(r, 10));

    // 光标应从 5 修正到 2，渲染不抛错，输出新值
    const output = lastFrameClean();
    expect(output).toContain('hi');
    expect(output).not.toContain('hello');
  });
});


describe('UncontrolledTextInput', () => {
  it('initialValue 作为初始渲染值', () => {
    const { lastFrameClean } = renderUncontrolled({
      focusId: 'inp',
      initialValue: 'default',
    });
    expect(lastFrameClean()).toContain('default');
  });

  it('输入后自动更新渲染', async () => {
    const { lastFrameClean, stdin } = renderUncontrolled({
      focusId: 'inp',
      initialValue: '',
    });

    await type(stdin, 'XY');
    expect(lastFrameClean()).toContain('XY');
  });

  it('退格后渲染更新', async () => {
    const { lastFrameClean, stdin } = renderUncontrolled({
      focusId: 'inp',
      initialValue: 'abc',
    });

    await press(stdin, KEYS.backspace);
    expect(lastFrameClean()).toContain('ab');
  });

  it('onSubmit 传递当前值', async () => {
    const onSubmit = vi.fn();
    const { stdin } = renderUncontrolled({
      focusId: 'inp',
      initialValue: 'submit-me',
      onSubmit,
    });

    await press(stdin, KEYS.enter);
    expect(onSubmit).toHaveBeenCalledWith('submit-me');
  });
});


describe('焦点隔离', () => {
  it('两个 TextInput 不同 focusId，Tab 切换后按键仅影响当前聚焦的', async () => {
    const onChangeA = vi.fn();
    const onChangeB = vi.fn();

    function HostScreen() {
      return React.createElement(
        'ink-virtual',
        null,
        React.createElement(TextInput, {
          focusId: 'input-a',
          value: '',
          onChange: onChangeA,
        }),
        React.createElement(TextInput, {
          focusId: 'input-b',
          value: '',
          onChange: onChangeB,
        }),
      );
    }
    HostScreen.displayName = 'DualHost';

    clearRegistry();
    registerComponent(HostScreen, {});

    const { stdin } = render(
      React.createElement(
        ScenarioManagementProvider,
        { defaultScreen: HostScreen },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );

    // input-a 先注册 → 默认聚焦
    await press(stdin, 'a');
    expect(onChangeA).toHaveBeenCalledWith('a');
    expect(onChangeB).not.toHaveBeenCalled();

    // Tab 切换到 input-b
    await press(stdin, KEYS.tab);

    onChangeA.mockClear();
    onChangeB.mockClear();

    await press(stdin, 'b');
    expect(onChangeB).toHaveBeenCalledWith('b');
    expect(onChangeA).not.toHaveBeenCalled();
  });
});



describe('特殊键不泄漏到通配符', () => {
  it('escape / tab / arrow 不触发 onChange', async () => {
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: 'test',
      onChange,
    });

    onChange.mockClear();

    await press(stdin, KEYS.escape);
    await press(stdin, KEYS.tab);
    await press(stdin, KEYS.up);
    await press(stdin, KEYS.down);

    // 通配符 '*' 不应捕获这些特殊键
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ctrl+字符不触发 onChange', async () => {
    // Ctrl+S 的 ASCII 码是 0x13。Ink 的输入层会将其解析为 ctrl+s。
    // 验证 isNormalCharacter 正确排除了 ctrl 修饰键。
    const onChange = vi.fn();
    const { stdin } = renderTextInput({
      focusId: 'inp',
      value: '',
      onChange,
    });

    stdin.write('\x13');
    await new Promise((r) => setTimeout(r, 10));

    expect(onChange).not.toHaveBeenCalled();
  });
});


describe('placeholder 边界', () => {
  it('空字符串 placeholder 且 value 为空时不抛错', () => {
    const { lastFrameClean } = renderTextInput({
      focusId: 'inp',
      value: '',
      onChange: () => {},
      placeholder: '',
    });

    expect(() => lastFrameClean()).not.toThrow();
  });

  it('placeholder 为单字符时正常工作', () => {
    const { lastFrameClean } = renderTextInput({
      focusId: 'inp',
      value: '',
      onChange: () => {},
      placeholder: '>',
    });

    expect(lastFrameClean()).toContain('>');
  });
});
