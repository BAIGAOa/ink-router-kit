import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React, { useEffect } from 'react';
import { Text } from 'ink';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { CurrentScreen } from '../../screen/current-screen.js';
import { KeyboardProvider, clearShortcutOperations } from '../../keyboard/provider.js';
import { useKeyboard } from '../../keyboard/hook.js';

async function flush() {
  await new Promise((r) => setTimeout(r, 10));
}

async function press(stdin: { write: (data: string) => void }, key: string) {
  stdin.write(key);
  await new Promise((r) => setTimeout(r, 10));
}

function renderKeyboardApi() {
  const kbRef: { current: ReturnType<typeof useKeyboard> | null } = { current: null };

  function HostScreen() {
    const kb = useKeyboard();
    useEffect(() => {
      kbRef.current = kb;
    }, [kb]);
    return <Text>API</Text>;
  }
  HostScreen.displayName = 'ApiHost';

  clearRegistry();
  registerComponent(HostScreen, {});

  const { lastFrame, stdin, unmount } = render(
    <ScenarioManagementProvider defaultScreen={HostScreen}>
      <KeyboardProvider>
        <CurrentScreen />
      </KeyboardProvider>
    </ScenarioManagementProvider>,
  );

  return { lastFrame, stdin, unmount, kbRef };
}

beforeEach(() => {
  clearRegistry();
  clearShortcutOperations();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('addAction', () => {
  it('正常注册单个 action 不抛错', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    expect(() => {
      kbRef.current!.addAction({ actionId: 'act-1', action: vi.fn() });
    }).not.toThrow();
  });

  it('重复 actionId 抛错', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    kbRef.current!.addAction({ actionId: 'dup', action: vi.fn() });

    expect(() => {
      kbRef.current!.addAction({ actionId: 'dup', action: vi.fn() });
    }).toThrow(/dup/);
  });
});

describe('hasAction', () => {
  it('已注册的 action 返回 true', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    kbRef.current!.addAction({ actionId: 'exists', action: vi.fn() });

    expect(kbRef.current!.hasAction('exists')).toBe(true);
  });

  it('未注册的 action 返回 false', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    expect(kbRef.current!.hasAction('no-such')).toBe(false);
  });
});

describe('removeAction', () => {
  it('删除已注册的 action，hasAction 返回 false', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    kbRef.current!.addAction({ actionId: 'to-remove', action: vi.fn() });
    expect(kbRef.current!.hasAction('to-remove')).toBe(true);

    kbRef.current!.removeAction('to-remove');
    expect(kbRef.current!.hasAction('to-remove')).toBe(false);
  });

  it('删除不存在的 action 抛错', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    expect(() => {
      kbRef.current!.removeAction('ghost');
    }).toThrow(/ghost/);
  });
});

describe('addAction + boundKeyboard 集成', () => {
  it('addAction 注册后，通过 boundKeyboard 可正常触发', async () => {
    const spy = vi.fn();
    const { kbRef, stdin } = renderKeyboardApi();
    await flush();

    kbRef.current!.addAction({ actionId: 'dynamic-act', action: spy });
    kbRef.current!.boundKeyboard(['x'], 'dynamic-act');

    await press(stdin, 'x');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('removeAction 后 boundKeyboard 引用该 actionId 抛错', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    kbRef.current!.addAction({ actionId: 'temp', action: vi.fn() });
    kbRef.current!.removeAction('temp');

    expect(() => {
      kbRef.current!.boundKeyboard(['y'], 'temp');
    }).toThrow(/temp/);
  });
});
