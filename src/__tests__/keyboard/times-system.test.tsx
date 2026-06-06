import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { useScreenSystem } from '../../screen/hook.js';
import { KeyboardProvider } from '../../keyboard/provider.js';
import { useKeyboard } from '../../keyboard/hook.js';
import type { Key } from 'ink';

// ── 模拟 useInput ──────────────────────────────────────────
let capturedInputHandler: ((input: string, key: Key) => void) | null = null;

vi.mock('ink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ink')>();
  return {
    ...actual,
    useInput: (handler: (input: string, key: Key) => void) => {
      capturedInputHandler = handler;
    },
  };
});

function pressKey(input: string, key: Partial<Key> = {}) {
  if (!capturedInputHandler) throw new Error('useInput handler not captured');
  capturedInputHandler(input, {
    upArrow: false, downArrow: false, leftArrow: false, rightArrow: false,
    return: false, escape: false, backspace: false, delete: false,
    tab: false, space: false, pageDown: false, pageUp: false,
    home: false, end: false, insert: false,
    ctrl: false, shift: false, meta: false, numLock: false,
    ...key,
  } as Key);
}

// ── 通用屏幕组件 ────────────────────────────────────────────
function Menu() {
  return React.createElement('div', null, 'Menu');
}
Menu.displayName = 'Menu';

function GameLevel({ level }: { level: number }) {
  return React.createElement('div', null, String(level));
}
GameLevel.displayName = 'GameLevel';

function Notification({ message }: { message: string }) {
  return React.createElement('div', null, message);
}
Notification.displayName = 'Notification';

function SubScreen() {
  return React.createElement('div', null, 'SubScreen');
}
SubScreen.displayName = 'SubScreen';

beforeEach(() => {
  clearRegistry();
  capturedInputHandler = null;
  registerComponent(Menu, {});
  registerComponent(GameLevel, { level: 1 }, { parent: Menu });
  registerComponent(Notification, { message: '' });
  registerComponent(SubScreen, {}, { parent: Menu });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 渲染辅助 ───────────────────────────────────────────────
function renderKeyboardTree(
  defaultScreen: React.ComponentType<any>,
): {
  getKeyboard: () => ReturnType<typeof useKeyboard> | null;
  getScreen: () => ReturnType<typeof useScreenSystem> | null;
} {
  const kbRef: { current: ReturnType<typeof useKeyboard> | null } = { current: null };
  const scRef: { current: ReturnType<typeof useScreenSystem> | null } = { current: null };

  function Spy() {
    const kb = useKeyboard();
    const sc = useScreenSystem();
    useEffect(() => {
      kbRef.current = kb;
      scRef.current = sc;
    }, [kb, sc]);
    return React.createElement('div', null);
  }

  // React.createElement 需要显式 import useEffect
  render(
    React.createElement(
      ScenarioManagementProvider,
      { defaultScreen },
      React.createElement(KeyboardProvider, null, React.createElement(Spy)),
    ),
  );

  return {
    getKeyboard: () => kbRef.current,
    getScreen: () => scRef.current,
  };
}

// 由于顶层不再 import useEffect，需要在模块作用域内引用
import { useEffect } from 'react';

// ── 测试套件 ────────────────────────────────────────────────

describe('times system — 基础功能', () => {
  it('times: 2 — handler 在第 2、4、6 次触发', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler, { times: 2 });

    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('a'); // 第2次 → 触发
    expect(handler).toHaveBeenCalledTimes(1);

    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(1);

    pressKey('a'); // 第4次 → 触发
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('times: 3 — handler 在第 3、6 次触发', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler, { times: 3 });

    pressKey('a');
    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('a'); // 第3次
    expect(handler).toHaveBeenCalledTimes(1);

    pressKey('a');
    pressKey('a');
    pressKey('a'); // 第6次
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('times: 1 — 与不设 times 行为一致', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler, { times: 1 });

    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(1);
    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('不设 times — 每次按键都触发（向后兼容）', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler);

    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(1);
    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('多 key 绑定共享计数器 — [\'a\', \'b\'], times: 2', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a', 'b'], handler, { times: 2 });

    pressKey('a'); // count=1
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('b'); // count=2 → 触发
    expect(handler).toHaveBeenCalledTimes(1);

    pressKey('a'); // count=1
    pressKey('b'); // count=2 → 触发
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('不同 binding 之间计数器独立', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler1, { times: 2 });
    getKeyboard()!.boundKeyboard(['b'], handler2, { times: 3 });

    pressKey('a'); // h1: count=1
    pressKey('b'); // h2: count=1
    expect(handler1).toHaveBeenCalledTimes(0);
    expect(handler2).toHaveBeenCalledTimes(0);

    pressKey('a'); // h1: count=2 → 触发
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(0);

    pressKey('b'); // h2: count=2
    pressKey('b'); // h2: count=3 → 触发
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('同一 key 多个 times binding — 按注册顺序匹配（先注册先消耗事件）', () => {
    const handler2 = vi.fn(); // times: 2, 先注册
    const handler3 = vi.fn(); // times: 3, 后注册
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['x'], handler2, { times: 2 });
    getKeyboard()!.boundKeyboard(['x'], handler3, { times: 3 });

    // 第一个 binding (times:2) 总是先匹配
    pressKey('x'); // h2: count=1
    pressKey('x'); // h2: count=2 → 触发 h2, 事件被消耗
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledTimes(0);

    pressKey('x'); // h2: count=1 (归零)
    pressKey('x'); // h2: count=2 → 触发 h2
    expect(handler2).toHaveBeenCalledTimes(2);
    expect(handler3).toHaveBeenCalledTimes(0);
  });
});

describe('times + once', () => {
  it('times: 3 + once: true — 第3次触发后解绑', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler, { times: 3, once: true });

    pressKey('a'); // count=1
    pressKey('a'); // count=2
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('a'); // count=3 → 触发并解绑
    expect(handler).toHaveBeenCalledTimes(1);

    // 已解绑
    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('times: 2 + once: true — handler 抛异常后绑定依然被移除', () => {
    const handler = vi.fn(() => {
      throw new Error('test error');
    });
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler, { times: 2, once: true });

    pressKey('a'); // count=1

    // 第2次触发 handler，但抛出异常
    expect(() => pressKey('a')).toThrow('test error');
    expect(handler).toHaveBeenCalledTimes(1);

    // 绑定已被移除
    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('times: 2, once: false — 第2次触发后不解除绑定，计数器归零继续', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler, { times: 2 });

    pressKey('a');
    pressKey('a'); // 触发
    expect(handler).toHaveBeenCalledTimes(1);

    pressKey('a');
    pressKey('a'); // 再次触发
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('once: true (无 times) — 保持现有行为：首次触发即解绑', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler, { once: true });

    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(1);

    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('times — 错误处理', () => {
  it('times: 0 抛出错误', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    expect(() => {
      getKeyboard()!.boundKeyboard(['a'], () => {}, { times: 0 });
    }).toThrow('[Ink-Router-Kit] boundKeyboard() times option must be >= 1.');
  });

  it('times: -1 抛出错误', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    expect(() => {
      getKeyboard()!.boundKeyboard(['a'], () => {}, { times: -1 });
    }).toThrow('[Ink-Router-Kit] boundKeyboard() times option must be >= 1.');
  });
});

describe('times + focusId', () => {
  it('focus target 上的 times binding 独立计数', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler, { times: 2, focusId: 'inp' });

    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(0);
    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('不同 focus target 上的 times binding 互不干扰', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler1, { times: 2, focusId: 'input1' });
    getKeyboard()!.boundKeyboard(['a'], handler2, { times: 3, focusId: 'input2' });

    // 只有 input1 活跃
    pressKey('a'); // input1: count=1
    pressKey('a'); // input1: count=2 → 触发
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(0);
  });

  it('times + focusId + once 组合', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], handler, { times: 2, focusId: 'inp', once: true });

    pressKey('a');
    pressKey('a'); // 触发并解绑
    expect(handler).toHaveBeenCalledTimes(1);

    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('times + onlyThis', () => {
  it('onlyThis 条件不满足时不消耗计数', () => {
    const handler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    // 导航到 GameLevel 并绑定
    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    getKeyboard()!.boundKeyboard(['a'], handler, { times: 2, onlyThis: true });

    pressKey('a'); // count=1
    expect(handler).toHaveBeenCalledTimes(0);

    // 打开 overlay → onlyThis 条件不满足
    act(() => getScreen()!.overlay(Notification, { message: 'test' }));
    pressKey('a'); // 应被跳过，不计入 counter
    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(0);

    // 关闭 overlay → onlyThis 条件重新满足
    act(() => getScreen()!.closeOverlay());
    pressKey('a'); // count=2 → 触发
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('onlyThis 条件满足时正常计数', () => {
    const handler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    getKeyboard()!.boundKeyboard(['a'], handler, { times: 2, onlyThis: true });

    pressKey('a');
    pressKey('a');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('times + 事件分层（冒泡）', () => {
  it('上层 times binding 即使未达阈值也消费事件，下层收不到', () => {
    const topHandler = vi.fn();
    const bottomHandler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    // Menu 作为底层，绑定普通 handler
    getKeyboard()!.boundKeyboard(['x'], bottomHandler);

    // 导航到 SubScreen 作为顶层，绑定 times
    act(() => getScreen()!.skip(SubScreen, {}));
    getKeyboard()!.boundKeyboard(['x'], topHandler, { times: 3 });

    // 顶层收到事件（count=1,2），虽然未触发，但事件被消费
    pressKey('x');
    expect(topHandler).toHaveBeenCalledTimes(0);
    expect(bottomHandler).toHaveBeenCalledTimes(0);

    pressKey('x');
    expect(topHandler).toHaveBeenCalledTimes(0);
    expect(bottomHandler).toHaveBeenCalledTimes(0);

    pressKey('x'); // count=3 → 触发顶层
    expect(topHandler).toHaveBeenCalledTimes(1);
    expect(bottomHandler).toHaveBeenCalledTimes(0);
  });

  it('全部次数触发后，下次计数继续消费事件', () => {
    const topHandler = vi.fn();
    const bottomHandler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['x'], bottomHandler);

    act(() => getScreen()!.skip(SubScreen, {}));
    getKeyboard()!.boundKeyboard(['x'], topHandler, { times: 2 });

    // 第1次
    pressKey('x');
    expect(topHandler).toHaveBeenCalledTimes(0);
    expect(bottomHandler).toHaveBeenCalledTimes(0);

    // 第2次 → 触发顶层
    pressKey('x');
    expect(topHandler).toHaveBeenCalledTimes(1);
    expect(bottomHandler).toHaveBeenCalledTimes(0);

    // 第3次 → 新的计数周期，count=1，仍然消费
    pressKey('x');
    expect(topHandler).toHaveBeenCalledTimes(1);
    expect(bottomHandler).toHaveBeenCalledTimes(0);
  });
});

describe('times + blockedKey', () => {
  it('blockedKey 穿透后下层 times 正常计数', () => {
    const topHandler = vi.fn();
    const bottomHandler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    // 底层：times binding
    getKeyboard()!.boundKeyboard(['x'], bottomHandler, { times: 2 });

    // 导航到 SubScreen 顶层
    act(() => getScreen()!.skip(SubScreen, {}));
    // 顶层：block 'x' 让它穿透
    getKeyboard()!.blockedKey(['x']);

    pressKey('x'); // 穿透到 Menu，count=1
    expect(bottomHandler).toHaveBeenCalledTimes(0);

    pressKey('x'); // 穿透到 Menu，count=2 → 触发
    expect(bottomHandler).toHaveBeenCalledTimes(1);
  });

  it('blockedKey + stop 组合：stop 阻止后下层 times 收不到', () => {
    const bottomHandler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['x'], bottomHandler, { times: 2 });

    act(() => getScreen()!.skip(SubScreen, {}));
    getKeyboard()!.stop(['x']); // stop 阻止传播到下层

    pressKey('x');
    pressKey('x');
    expect(bottomHandler).toHaveBeenCalledTimes(0);
  });
});

describe('times + 通配符 *', () => {
  it('通配符 binding 支持 times', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['*'], handler, { times: 2 });

    pressKey('a'); // count=1
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('b'); // count=2 → 触发
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('b', expect.objectContaining({}));
  });

  it('通配符 + times，特殊键不消耗计数', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['*'], handler, { times: 2 });

    pressKey('a'); // count=1
    // escape 不触发通配符，也不应消耗计数
    pressKey('', { escape: true });
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('b'); // count=2 → 触发
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('times + 修饰键', () => {
  it('ctrl+字符支持 times', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['ctrl+d'], handler, { times: 2 });

    pressKey('d', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('d', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('特殊键（escape/return）支持 times', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['escape'], handler, { times: 3 });

    pressKey('', { escape: true });
    pressKey('', { escape: true });
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('', { escape: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('times + overlay', () => {
  it('overlay 上的 times binding 优先于屏幕栈 times binding', () => {
    const screenHandler = vi.fn();
    const overlayHandler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['escape'], screenHandler, { times: 2 });

    act(() => getScreen()!.overlay(Notification, { message: 'test' }));
    getKeyboard()!.boundKeyboard(['escape'], overlayHandler, { times: 2 });

    // overlay 上的计数
    pressKey('', { escape: true });
    pressKey('', { escape: true });
    expect(overlayHandler).toHaveBeenCalledTimes(1);
    expect(screenHandler).toHaveBeenCalledTimes(0);
  });
});
