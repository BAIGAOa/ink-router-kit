import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { useRef, useEffect } from 'react';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { useScreenSystem } from '../../screen/hook.js';
import { KeyboardProvider } from '../../keyboard/provider.js';
import { useKeyboard, useFocusState } from '../../keyboard/hook.js';
import type { Key } from 'ink';

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

function pressKey(input: string, key: Partial<Key>) {
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

function Menu({ }: {}) {
  return React.createElement('div', null, 'Menu');
}
Menu.displayName = 'Menu';

function GameLevel({ level }: { level: number }) {
  return React.createElement('div', null, String(level));
}
GameLevel.displayName = 'GameLevel';

function Combat({ enemy }: { enemy: string }) {
  return React.createElement('div', null, enemy);
}
Combat.displayName = 'Combat';

function Notification({ message }: { message: string }) {
  return React.createElement('div', null, message);
}
Notification.displayName = 'Notification';

beforeEach(() => {
  clearRegistry();
  capturedInputHandler = null;
  registerComponent(Menu, {});
  registerComponent(GameLevel, { level: 1 }, { parent: Menu });
  registerComponent(Combat, { enemy: 'goblin' }, { parent: GameLevel });
  registerComponent(Notification, { message: '' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
    kbRef.current = kb;
    scRef.current = sc;
    useEffect(() => {
      kbRef.current = kb;
      scRef.current = sc;
    }, [kb, sc]);
    return React.createElement('div', null);
  }

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

function renderWithFocusConsumer(
  defaultScreen: React.ComponentType<any>,
  focusId: string,
): {
  getFocused: () => boolean;
  getKeyboard: () => ReturnType<typeof useKeyboard> | null;
} {
  const focusedRef: { current: boolean } = { current: false };
  const kbRef: { current: ReturnType<typeof useKeyboard> | null } = { current: null };

  function Consumer() {
    const kb = useKeyboard();
    const focused = useFocusState(focusId);
    kbRef.current = kb;
    focusedRef.current = focused;
    useEffect(() => {
      focusedRef.current = focused;
    }, [focused]);
    return React.createElement('div', null, focused ? 'yes' : 'no');
  }

  render(
    React.createElement(
      ScenarioManagementProvider,
      { defaultScreen },
      React.createElement(KeyboardProvider, null, React.createElement(Consumer)),
    ),
  );

  return {
    getFocused: () => focusedRef.current,
    getKeyboard: () => kbRef.current,
  };
}

describe('按键名标准化', () => {
  it('useInput 在 KeyboardProvider 挂载后被捕获', () => {
    renderKeyboardTree(Menu);
    expect(capturedInputHandler).not.toBeNull();
  });

  it('ctrl+s 会被捕获为 ctrl+s', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['ctrl+s'], cb);
    pressKey('s', { ctrl: true });
    expect(cb).toHaveBeenCalledWith('s', expect.objectContaining({ ctrl: true }));
  });

  it('return 键被正确识别', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['return'], cb);
    pressKey('', { return: true });
    expect(cb).toHaveBeenCalled();
  });

  it('escape 键被正确识别', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['escape'], cb);
    pressKey('', { escape: true });
    expect(cb).toHaveBeenCalled();
  });

  it('shift+tab 被正确识别（不作为焦点导航，因为无 focusTargets）', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['shift+tab'], cb);
    pressKey('', { tab: true, shift: true });
    expect(cb).toHaveBeenCalled();
  });
});

describe('boundKeyboard（屏幕级，无 focusId）', () => {
  it('绑定单键回调，按键时触发', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['s'], cb);
    pressKey('s', {});
    expect(cb).toHaveBeenCalledWith('s', expect.any(Object));
  });

  it('多键绑定同一回调', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a', 'b', 'c'], cb);
    pressKey('a', {}); expect(cb).toHaveBeenCalledTimes(1);
    pressKey('b', {}); expect(cb).toHaveBeenCalledTimes(2);
    pressKey('c', {}); expect(cb).toHaveBeenCalledTimes(3);
  });

  it('返回的解绑函数可取消绑定', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    const unbind = getKeyboard()!.boundKeyboard(['x'], cb);
    unbind();
    pressKey('x', {});
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('责任链冒泡（栈顶 → 栈底）', () => {
  it('栈顶处理了，底层不触发', () => {
    const menuCb = vi.fn();
    const combatCb = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['e'], menuCb);
    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    act(() => getScreen()!.skip(Combat, { enemy: 'goblin' }));
    getKeyboard()!.boundKeyboard(['e'], combatCb);
    pressKey('e', {});
    expect(combatCb).toHaveBeenCalledTimes(1);
    expect(menuCb).not.toHaveBeenCalled();
  });

  it('栈顶未处理，冒泡到下层', () => {
    const menuCb = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['e'], menuCb);
    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    act(() => getScreen()!.skip(Combat, { enemy: 'goblin' }));
    pressKey('e', {});
    expect(menuCb).toHaveBeenCalledTimes(1);
  });

  it('所有层都未处理则丢弃', () => {
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);
    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    expect(() => pressKey('z', {})).not.toThrow();
  });
});

describe('blockedKey（屏幕级，无 focusId）', () => {
  it('屏蔽的键在本层穿透，下层可处理', () => {
    const menuCb = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['e'], menuCb);
    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    act(() => getScreen()!.skip(Combat, { enemy: 'goblin' }));
    getKeyboard()!.blockedKey(['e']);
    pressKey('e', {});
    expect(menuCb).toHaveBeenCalledTimes(1);
  });

  it('blockedKey 不影响其他键', () => {
    const cb = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);
    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    act(() => getScreen()!.skip(Combat, { enemy: 'goblin' }));
    getKeyboard()!.blockedKey(['e']);
    getKeyboard()!.boundKeyboard(['s'], cb);
    pressKey('s', {});
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('blockedKey 只对本层生效', () => {
    const menuCb = vi.fn();
    const gameCb = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['e'], menuCb);
    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    getKeyboard()!.boundKeyboard(['e'], gameCb);
    act(() => getScreen()!.skip(Combat, { enemy: 'goblin' }));
    pressKey('e', {});
    expect(gameCb).toHaveBeenCalledTimes(1);
    expect(menuCb).not.toHaveBeenCalled();
  });
});

describe('onlyThis', () => {
  it('onlyThis=true 只在栈顶且无 overlay 时激活', () => {
    const combatCb = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);
    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    act(() => getScreen()!.skip(Combat, { enemy: 'goblin' }));
    getKeyboard()!.boundKeyboard(['a'], combatCb, { onlyThis: true });
    pressKey('a', {});
    expect(combatCb).toHaveBeenCalledTimes(1);
    act(() => getScreen()!.overlay(Notification, { message: 'test' }));
    combatCb.mockClear();
    pressKey('a', {});
    expect(combatCb).not.toHaveBeenCalled();
  });
});

describe('Overlay 优先级', () => {
  it('overlay 的绑定优先于屏幕栈', () => {
    const screenCb = vi.fn();
    const overlayCb = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);
    act(() => getScreen()!.overlay(Notification, { message: 'test' }));
    getKeyboard()!.boundKeyboard(['escape'], overlayCb);
    getKeyboard()!.boundKeyboard(['escape'], screenCb);
    pressKey('', { escape: true });
    expect(overlayCb).toHaveBeenCalledTimes(1);
    expect(screenCb).not.toHaveBeenCalled();
  });

  it('overlay 未处理时冒泡到屏幕栈', () => {
    const menuCb = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['e'], menuCb);
    act(() => getScreen()!.overlay(Notification, { message: 'test' }));
    pressKey('e', {});
    expect(menuCb).toHaveBeenCalledTimes(1);
  });
});

describe('层生命周期', () => {
  it('离开路径后层被清理，绑定不再生效', () => {
    const combatCb = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);
    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    act(() => getScreen()!.skip(Combat, { enemy: 'goblin' }));
    getKeyboard()!.boundKeyboard(['a'], combatCb);
    act(() => getScreen()!.back());
    combatCb.mockClear();
    pressKey('a', {});
    expect(combatCb).not.toHaveBeenCalled();
  });
});

describe('修饰键组合', () => {
  it('ctrl+字符被正确匹配', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['ctrl+d'], cb);
    pressKey('d', { ctrl: true });
    expect(cb).toHaveBeenCalled();
  });

  it('meta+字符被正确匹配', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['meta+f'], cb);
    pressKey('f', { meta: true });
    expect(cb).toHaveBeenCalled();
  });
});

describe('boundKeyboard 带 focusId', () => {
  it('focusId 绑定优先于同层屏幕级绑定', () => {
    const screenCb = vi.fn();
    const focusCb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['a'], screenCb);
    getKeyboard()!.boundKeyboard(['a'], focusCb, { focusId: 'input1' });

    pressKey('a', {});
    expect(focusCb).toHaveBeenCalledTimes(1);
    expect(screenCb).not.toHaveBeenCalled();
  });

  it('多个 focusId 注册，只有当前聚焦的收到事件', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['a'], cb1, { focusId: 'input1' });
    getKeyboard()!.boundKeyboard(['a'], cb2, { focusId: 'input2' });

    // input1 是第一个注册的，自动激活
    pressKey('a', {});
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();

    // 切换到 input2
    getKeyboard()!.focusSet('input2');
    cb1.mockClear();
    pressKey('a', {});
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).not.toHaveBeenCalled();
  });

  it('focusId 绑定的解绑函数正常工作', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    const unbind = getKeyboard()!.boundKeyboard(['x'], cb, { focusId: 'inp' });
    unbind();
    pressKey('x', {});
    expect(cb).not.toHaveBeenCalled();
  });

  it('focusId 绑定受 globalKeys cover: false 约束', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.globalKeys([
      { key: 'q', operate: () => {}, cover: false },
    ]);

    expect(() =>
      getKeyboard()!.boundKeyboard(['q'], () => {}, { focusId: 'inp' }),
    ).toThrow('cover: false');
  });
});

describe('blockedKey 带 focusId', () => {
  it('focus 级 blockedKey 穿透 focus target 绑定，冒泡到屏幕级', () => {
    const screenCb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['e'], () => {}, { focusId: 'inp1' });
    getKeyboard()!.blockedKey(['e'], { focusId: 'inp1' });
    getKeyboard()!.boundKeyboard(['e'], screenCb);

    pressKey('e', {});
    expect(screenCb).toHaveBeenCalledTimes(1);
  });

  it('focus 级 blockedKey 不影响其他键', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.blockedKey(['e'], { focusId: 'inp1' });
    getKeyboard()!.boundKeyboard(['s'], cb, { focusId: 'inp1' });

    pressKey('s', {});
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('stop 带 focusId', () => {
  it('focus 级 stop 阻止按键向屏幕级冒泡', () => {
    const screenCb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['e'], screenCb);
    getKeyboard()!.stop(['e'], { focusId: 'inp1' });

    pressKey('e', {});
    expect(screenCb).not.toHaveBeenCalled();
  });

  it('focus 级 stop 解绑后可恢复传播', () => {
    const screenCb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['e'], screenCb);
    const unstop = getKeyboard()!.stop(['e'], { focusId: 'inp1' });

    pressKey('e', {});
    expect(screenCb).not.toHaveBeenCalled();

    unstop();
    pressKey('e', {});
    expect(screenCb).toHaveBeenCalledTimes(1);
  });

  it('focus 级 stop 仅对当前 focus target 生效，不影响其他 focus', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['x'], cb1, { focusId: 'inp1' });
    getKeyboard()!.boundKeyboard(['x'], cb2, { focusId: 'inp2' });
    getKeyboard()!.stop(['x'], { focusId: 'inp2' });

    pressKey('x', {});
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();

    getKeyboard()!.focusSet('inp2');
    cb1.mockClear();
    pressKey('x', {});
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});

describe('focusSet / focusNext / focusPrev / focusCurrent', () => {
  it('focusSet 切换到指定 focusId', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], () => {}, { focusId: 'one' });
    getKeyboard()!.boundKeyboard(['b'], () => {}, { focusId: 'two' });

    expect(getKeyboard()!.focusCurrent()).toBe('one');
    getKeyboard()!.focusSet('two');
    expect(getKeyboard()!.focusCurrent()).toBe('two');
  });

  it('focusSet 对不存在的 focusId 无操作', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], () => {}, { focusId: 'one' });
    getKeyboard()!.focusSet('nonexistent');
    expect(getKeyboard()!.focusCurrent()).toBe('one');
  });

  it('focusNext 按注册顺序轮转', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], () => {}, { focusId: 'one' });
    getKeyboard()!.boundKeyboard(['b'], () => {}, { focusId: 'two' });
    getKeyboard()!.boundKeyboard(['c'], () => {}, { focusId: 'three' });

    expect(getKeyboard()!.focusCurrent()).toBe('one');
    getKeyboard()!.focusNext();
    expect(getKeyboard()!.focusCurrent()).toBe('two');
    getKeyboard()!.focusNext();
    expect(getKeyboard()!.focusCurrent()).toBe('three');
    getKeyboard()!.focusNext();
    expect(getKeyboard()!.focusCurrent()).toBe('one');
  });

  it('focusPrev 逆向轮转', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], () => {}, { focusId: 'one' });
    getKeyboard()!.boundKeyboard(['b'], () => {}, { focusId: 'two' });
    getKeyboard()!.boundKeyboard(['c'], () => {}, { focusId: 'three' });

    expect(getKeyboard()!.focusCurrent()).toBe('one');
    getKeyboard()!.focusPrev();
    expect(getKeyboard()!.focusCurrent()).toBe('three');
    getKeyboard()!.focusPrev();
    expect(getKeyboard()!.focusCurrent()).toBe('two');
  });

  it('focusCurrent 无焦点目标时返回 null', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    expect(getKeyboard()!.focusCurrent()).toBeNull();
  });
});

describe('focusUnregister', () => {
  it('注销后 focusId 被移除', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], () => {}, { focusId: 'one' });
    getKeyboard()!.boundKeyboard(['b'], () => {}, { focusId: 'two' });

    getKeyboard()!.focusUnregister('one');
    expect(getKeyboard()!.focusCurrent()).toBe('two');
  });

  it('注销当前聚焦的 target 后自动切换到下一个', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], () => {}, { focusId: 'one' });
    getKeyboard()!.boundKeyboard(['b'], () => {}, { focusId: 'two' });

    getKeyboard()!.focusUnregister('one');
    expect(getKeyboard()!.focusCurrent()).toBe('two');
  });

  it('注销最后一个 focus target 后 currentFocusId 为 null', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], () => {}, { focusId: 'one' });
    getKeyboard()!.focusUnregister('one');
    expect(getKeyboard()!.focusCurrent()).toBeNull();
  });

  it('注销后该 focusId 的绑定不再响应', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.boundKeyboard(['a'], cb, { focusId: 'one' });
    getKeyboard()!.boundKeyboard(['b'], () => {}, { focusId: 'two' });

    getKeyboard()!.focusUnregister('one');
    pressKey('a', {});
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('subscribeFocus / useFocusState', () => {
  it('useFocusState 在 focusId 激活时返回 true', () => {
    const result = renderWithFocusConsumer(Menu, 'inp1');
    expect(result.getFocused()).toBe(false);

    act(() => {
      result.getKeyboard()!.boundKeyboard(['a'], () => {}, { focusId: 'inp1' });
    });

    expect(result.getFocused()).toBe(true);
  });

  it('useFocusState 在焦点切换后更新', () => {
    const result = renderWithFocusConsumer(Menu, 'inp2');

    act(() => {
      result.getKeyboard()!.boundKeyboard(['a'], () => {}, { focusId: 'inp1' });
      result.getKeyboard()!.boundKeyboard(['b'], () => {}, { focusId: 'inp2' });
    });

    expect(result.getFocused()).toBe(false);

    act(() => {
      result.getKeyboard()!.focusSet('inp2');
    });

    expect(result.getFocused()).toBe(true);
  });

  it('useFocusState 在焦点注销后更新', () => {
    const result = renderWithFocusConsumer(Menu, 'inp1');

    act(() => {
      result.getKeyboard()!.boundKeyboard(['a'], () => {}, { focusId: 'inp1' });
      result.getKeyboard()!.boundKeyboard(['b'], () => {}, { focusId: 'inp2' });
    });

    expect(result.getFocused()).toBe(true);

    act(() => {
      result.getKeyboard()!.focusUnregister('inp1');
    });

    expect(result.getFocused()).toBe(false);
  });
});

describe('内置 Tab 焦点导航', () => {
  it('Tab 键自动切换到下一个 focus target', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['return'], cb1, { focusId: 'one' });
    getKeyboard()!.boundKeyboard(['return'], cb2, { focusId: 'two' });

    pressKey('', { return: true });
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();

    pressKey('', { tab: true });
    cb1.mockClear();
    pressKey('', { return: true });
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).not.toHaveBeenCalled();
  });

  it('Shift+Tab 逆序切换', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['return'], cb1, { focusId: 'one' });
    getKeyboard()!.boundKeyboard(['return'], cb2, { focusId: 'two' });

    pressKey('', { tab: true, shift: true });
    pressKey('', { return: true });
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).not.toHaveBeenCalled();
  });

  it('Tab 在无 focus target 时不消费事件，屏幕级 tab 绑定仍可工作', () => {
    const cb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['tab'], cb);
    pressKey('', { tab: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('Tab 在有 focus target 时不冒泡到屏幕级', () => {
    const screenCb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['tab'], screenCb);
    getKeyboard()!.boundKeyboard(['a'], () => {}, { focusId: 'one' });
    getKeyboard()!.boundKeyboard(['b'], () => {}, { focusId: 'two' });

    pressKey('', { tab: true });
    expect(screenCb).not.toHaveBeenCalled();
  });
});

describe('焦点层内的 onlyThis', () => {
  it('focus 级绑定使用 onlyThis 时，有 overlay 则跳过', () => {
    const cb = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['a'], cb, { focusId: 'inp', onlyThis: true });

    pressKey('a', {});
    expect(cb).toHaveBeenCalledTimes(1);

    act(() => getScreen()!.overlay(Notification, { message: 'test' }));
    cb.mockClear();
    pressKey('a', {});
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('overlay 内部的焦点系统', () => {
  it('overlay 内的 Tab 切换 overlay 内部焦点，不影响屏幕栈焦点', () => {
    const overlayCb1 = vi.fn();
    const overlayCb2 = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    act(() => getScreen()!.overlay(Notification, { message: 'test' }));

    getKeyboard()!.boundKeyboard(['return'], overlayCb1, { focusId: 'over1' });
    getKeyboard()!.boundKeyboard(['return'], overlayCb2, { focusId: 'over2' });

    pressKey('', { return: true });
    expect(overlayCb1).toHaveBeenCalledTimes(1);

    pressKey('', { tab: true });
    overlayCb1.mockClear();
    pressKey('', { return: true });
    expect(overlayCb2).toHaveBeenCalledTimes(1);
  });
});

describe('焦点与屏幕级 stop 的交互', () => {
  it('focus 级绑定触发后，屏幕级 stop 不影响它', () => {
    const focusCb = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.boundKeyboard(['a'], focusCb, { focusId: 'inp' });
    getKeyboard()!.stop(['a']);

    pressKey('a', {});
    expect(focusCb).toHaveBeenCalledTimes(1);
  });
});

describe('屏幕切换后焦点重置', () => {
  it('skip 到新屏幕后，新屏幕的焦点从第一个注册的开始', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    act(() => getScreen()!.skip(GameLevel, { level: 1 }));

    getKeyboard()!.boundKeyboard(['a'], cb1, { focusId: 'g1' });
    getKeyboard()!.boundKeyboard(['a'], cb2, { focusId: 'g2' });

    expect(getKeyboard()!.focusCurrent()).toBe('g1');
    pressKey('a', {});
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();
  });
});
