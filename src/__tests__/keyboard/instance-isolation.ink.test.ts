import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React, { useEffect } from 'react';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { KeyboardProvider } from '../../keyboard/provider.js';
import { useKeyboard } from '../../keyboard/hook.js';

function HostScreen() {
  return React.createElement('div', null, 'Host');
}
HostScreen.displayName = 'Host';

function renderIsolatedProvider() {
  const kbRef: { current: ReturnType<typeof useKeyboard> | null } = {
    current: null,
  };

  function Spy() {
    const kb = useKeyboard();
    kbRef.current = kb;
    useEffect(() => {
      kbRef.current = kb;
    }, [kb]);
    return React.createElement('div', null);
  }

  clearRegistry();
  registerComponent(HostScreen, {});

  const result = render(
    React.createElement(
      ScenarioManagementProvider,
      { defaultScreen: HostScreen },
      React.createElement(KeyboardProvider, null, React.createElement(Spy)),
    ),
  );

  return {
    kb: () => kbRef.current!,
    unmount: result.unmount,
  };
}

beforeEach(() => {
  clearRegistry();
  registerComponent(HostScreen, {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('两个 KeyboardProvider 实例完全隔离', () => {

  it('实例 A 注册的 shortcut 在实例 B 中不可用', () => {
    const a = renderIsolatedProvider();
    const b = renderIsolatedProvider();

    a.kb().defineShortcutAction([{ actionId: 'a-only', action: vi.fn() }]);

    expect(() => {
      b.kb().boundKeyboard(['x'], 'a-only');
    }).toThrow(/a-only/);

    a.unmount();
    b.unmount();
  });

  it('两个实例可以各自注册同名 shortcut 互不冲突', () => {
    const a = renderIsolatedProvider();
    const b = renderIsolatedProvider();

    const spyA = vi.fn();
    const spyB = vi.fn();

    expect(() => a.kb().defineShortcutAction([{ actionId: 'shared', action: spyA }])).not.toThrow();
    expect(() => b.kb().defineShortcutAction([{ actionId: 'shared', action: spyB }])).not.toThrow();

    expect(() => a.kb().boundKeyboard(['a'], 'shared')).not.toThrow();
    expect(() => b.kb().boundKeyboard(['b'], 'shared')).not.toThrow();

    a.unmount();
    b.unmount();
  });

  it('实例 A 的 globalKeys 不影响实例 B', () => {
    const a = renderIsolatedProvider();
    const b = renderIsolatedProvider();

    const spyA = vi.fn();
    a.kb().defineShortcutAction([{ actionId: 'quit-a', action: spyA }]);
    a.kb().globalKeys([{ key: 'q', operate: 'quit-a' }]);

    expect(() => {
      b.kb().globalKeys([{ key: 'z', operate: 'quit-a' } as any]);
    }).toThrow(/quit-a/);

    a.unmount();
    b.unmount();
  });

  it('实例 A 注册的 focus target 在实例 B 中不存在，应抛出错误', () => {
    const a = renderIsolatedProvider();
    const b = renderIsolatedProvider();

    a.kb().boundKeyboard(['return'], () => {}, { focusId: 'btn-a' });

    expect(b.kb().focusCurrent()).toBeNull();
    expect(() => b.kb().focusSet('btn-a'))
      .toThrow(/focus target not found.*btn-a|no keyboard layer found/);
    expect(b.kb().focusCurrent()).toBeNull();

    a.unmount();
    b.unmount();
  });

  it('实例 A 的 focusNext 不影响实例 B 的焦点状态', () => {
    const a = renderIsolatedProvider();
    const b = renderIsolatedProvider();

    a.kb().boundKeyboard(['a'], () => {}, { focusId: 'a1' });
    a.kb().boundKeyboard(['b'], () => {}, { focusId: 'a2' });
    a.kb().boundKeyboard(['c'], () => {}, { focusId: 'a3' });

    b.kb().boundKeyboard(['x'], () => {}, { focusId: 'b1' });
    b.kb().boundKeyboard(['y'], () => {}, { focusId: 'b2' });

    expect(a.kb().focusCurrent()).toBe('a1');
    a.kb().focusNext();
    expect(a.kb().focusCurrent()).toBe('a2');
    a.kb().focusNext();
    expect(a.kb().focusCurrent()).toBe('a3');

    expect(b.kb().focusCurrent()).toBe('b1');

    a.unmount();
    b.unmount();
  });

  it('实例 A 的 boundKeyboard 绑定不泄漏到实例 B', () => {
    const a = renderIsolatedProvider();
    const b = renderIsolatedProvider();

    a.kb().boundKeyboard(['enter'], vi.fn());

    expect(() => b.kb().stop(['enter'])).not.toThrow();

    a.unmount();
    b.unmount();
  });

  it('实例 A 的 blockedKey 不影响实例 B', () => {
    const a = renderIsolatedProvider();
    const b = renderIsolatedProvider();

    a.kb().blockedKey(['escape']);

    const spyB = vi.fn();
    expect(() => b.kb().boundKeyboard(['escape'], spyB)).not.toThrow();

    a.unmount();
    b.unmount();
  });

  it('两个实例同时存活，各自独立运转', () => {
    const a = renderIsolatedProvider();
    const b = renderIsolatedProvider();

    const spyA = vi.fn();
    a.kb().defineShortcutAction([{ actionId: 'go', action: spyA }]);
    a.kb().boundKeyboard(['g'], 'go');
    a.kb().boundKeyboard(['a'], () => {}, { focusId: 'fa1' });
    a.kb().boundKeyboard(['b'], () => {}, { focusId: 'fa2' });
    a.kb().blockedKey(['x']);

    const spyB = vi.fn();
    b.kb().defineShortcutAction([{ actionId: 'run', action: spyB }]);
    b.kb().boundKeyboard(['r'], 'run');
    b.kb().boundKeyboard(['c'], () => {}, { focusId: 'fb1' });
    b.kb().boundKeyboard(['d'], () => {}, { focusId: 'fb2' });
    b.kb().blockedKey(['y']);

    expect(() => a.kb().boundKeyboard(['g2'], 'go')).not.toThrow();
    expect(a.kb().focusCurrent()).toBe('fa1');
    a.kb().focusNext();
    expect(a.kb().focusCurrent()).toBe('fa2');

    expect(() => b.kb().boundKeyboard(['z'], 'go')).toThrow(/go/);
    expect(b.kb().focusCurrent()).toBe('fb1');
    expect(() => b.kb().boundKeyboard(['r2'], 'run')).not.toThrow();

    a.unmount();
    b.unmount();
  });

  it('卸载实例 A 后实例 B 仍然正常工作', () => {
    const a = renderIsolatedProvider();
    const b = renderIsolatedProvider();

    const spyB = vi.fn();
    b.kb().defineShortcutAction([{ actionId: 'stay', action: spyB }]);
    b.kb().boundKeyboard(['s'], 'stay');
    b.kb().boundKeyboard(['t'], () => {}, { focusId: 'fb' });

    a.unmount();

    expect(b.kb().focusCurrent()).toBe('fb');
    expect(() => b.kb().boundKeyboard(['s2'], 'stay')).not.toThrow();
    expect(() => b.kb().boundKeyboard(['x'], 'a-only-ghost')).toThrow();

    b.unmount();
  });
});
