import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React, { useEffect } from 'react';
import { Text } from 'ink';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { CurrentScreen } from '../../screen/current-screen.js';
import { KeyboardProvider, clearShortcutOperations } from '../../keyboard/provider.js';
import { useKeyboard } from '../../keyboard/hook.js';
import { useScreenSystem } from '../../screen/hook.js';

// 等待一个微任务周期，让 React effects 刷完
async function flush() {
  await new Promise((r) => setTimeout(r, 10));
}


// 向 stdin 写入字符模拟按键，包含 10ms 等待让 Ink 处理
async function press(
  stdin: { write: (data: string) => void },
  key: string,
) {
  stdin.write(key);
  await new Promise((r) => setTimeout(r, 10));
}

// 渲染一个最简屏幕，通过 ref 暴露 useKeyboard API
// 适用于不需要按键交互、只需验证 API 行为的用例
function renderKeyboardApi() {
  const kbRef: { current: ReturnType<typeof useKeyboard> | null } = {
    current: null,
  };

  function Host() {
    const kb = useKeyboard();
    useEffect(() => {
      kbRef.current = kb;
    }, [kb]);
    return <Text>API</Text>;
  }
  Host.displayName = 'ApiHost';

  clearRegistry();
  registerComponent(Host, {});

  const { stdin, unmount } = render(
    <ScenarioManagementProvider defaultScreen={Host}>
      <KeyboardProvider>
        <CurrentScreen />
      </KeyboardProvider>
    </ScenarioManagementProvider>,
  );

  return { stdin, unmount, kbRef };
}

// 渲染 Menu → Game 两级屏幕栈，Menu 为下层、Game 为上层
// Menu 绑 's' 跳转到 Game；Game 绑 'b' 返回 Menu
// 两个屏幕各自在 useEffect 中对 'e' 绑定 handler，
// Game 额外对 'e' 调用 blockedKey，并暴露解绑函数
function renderScreenStack() {
  let unblockFromGame!: () => void;

  const menuHandler = vi.fn();
  const gameHandler = vi.fn();

  function Menu() {
    const sc = useScreenSystem();
    const kb = useKeyboard();
    useEffect(() => {
      kb.boundKeyboard(['s'], () => sc.skip(Game, {}));
      kb.boundKeyboard(['e'], menuHandler);
    }, []);
    return <Text>Menu</Text>;
  }
  Menu.displayName = 'Menu';

  function Game() {
    const sc = useScreenSystem();
    const kb = useKeyboard();
    useEffect(() => {
      kb.boundKeyboard(['b'], () => sc.back());
      kb.boundKeyboard(['e'], gameHandler);
      unblockFromGame = kb.blockedKey(['e']);
    }, []);
    return <Text>Game</Text>;
  }
  Game.displayName = 'Game';

  clearRegistry();
  registerComponent(Menu, {});
  registerComponent(Game, {}, { parent: Menu });

  const { lastFrame, stdin, unmount } = render(
    <ScenarioManagementProvider defaultScreen={Menu}>
      <KeyboardProvider>
        <CurrentScreen />
      </KeyboardProvider>
    </ScenarioManagementProvider>,
  );

  return {
    lastFrame: () => lastFrame(),
    stdin,
    unmount,
    menuHandler,
    gameHandler,
    unblock: () => unblockFromGame(),
  };
}

beforeEach(() => {
  clearRegistry();
  clearShortcutOperations();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('blockedKey 解绑函数', () => {
  // 场景 1：验证 blockedKey 返回函数类型，且多次调用不抛错（幂等）
  it('返回一个函数，多次调用不抛错', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    const unblock = kbRef.current!.blockedKey(['x']);
    expect(typeof unblock).toBe('function');

    expect(() => unblock()).not.toThrow();
    expect(() => unblock()).not.toThrow();
  });

  // 场景 2：屏幕栈中，屏蔽键穿透到下层，解绑后本层恢复拦截
  it('屏幕级屏蔽时穿透到下层，解绑后本层拦截', async () => {
    const { stdin, menuHandler, gameHandler, unblock, lastFrame } =
      renderScreenStack();

    // 按 s 进入 Game
    await press(stdin, 's');
    expect(lastFrame()).toContain('Game');

    // Game 对 'e' 调了 blockedKey → 穿透到 Menu
    await press(stdin, 'e');
    expect(menuHandler).toHaveBeenCalledTimes(1);
    expect(gameHandler).not.toHaveBeenCalled();

    // 解绑
    menuHandler.mockClear();
    unblock();

    // 解绑后 Game 的 'e' 绑定恢复，拦截按键
    await press(stdin, 'e');
    expect(gameHandler).toHaveBeenCalledTimes(1);
    expect(menuHandler).not.toHaveBeenCalled();
  });

  // 场景 3：focus 级 blockedKey 穿透到屏幕级，解绑后 focus 级恢复
  it('focus 级屏蔽穿透到屏幕级，解绑后 focus 级拦截', async () => {
    const screenHandler = vi.fn();
    const focusHandler = vi.fn();

    const { kbRef, stdin } = renderKeyboardApi();
    await flush();

    // 屏幕级兜底绑定
    kbRef.current!.boundKeyboard(['e'], screenHandler);
    // focus 级绑定（同一键）
    kbRef.current!.boundKeyboard(['e'], focusHandler, { focusId: 'inp' });
    // focus 级屏蔽 'e'
    const unblockFocus = kbRef.current!.blockedKey(['e'], { focusId: 'inp' });

    // focus 级被穿透 → 屏幕级兜底触发
    await press(stdin, 'e');
    expect(screenHandler).toHaveBeenCalledTimes(1);
    expect(focusHandler).not.toHaveBeenCalled();

    // 解绑 focus 级屏蔽
    screenHandler.mockClear();
    unblockFocus();

    // focus 级绑定恢复拦截，屏幕级不再收到
    await press(stdin, 'e');
    expect(focusHandler).toHaveBeenCalledTimes(1);
    expect(screenHandler).not.toHaveBeenCalled();
  });

  // 场景 4：同时屏蔽多个键，仅解绑其中一个，另一个保持穿透
  it('只移除指定键，同层其他 blockedKey 不受影响', async () => {
    const menuA = vi.fn();
    const menuB = vi.fn();
    const gameA = vi.fn();
    const gameB = vi.fn();

    let unblockB!: () => void;

    function Menu() {
      const sc = useScreenSystem();
      const kb = useKeyboard();
      useEffect(() => {
        kb.boundKeyboard(['s'], () => sc.skip(Game, {}));
        kb.boundKeyboard(['a'], menuA);
        kb.boundKeyboard(['b'], menuB);
      }, []);
      return <Text>Menu</Text>;
    }
    Menu.displayName = 'Menu';

    function Game() {
      const sc = useScreenSystem();
      const kb = useKeyboard();
      useEffect(() => {
        kb.boundKeyboard(['escape'], () => sc.back());
        kb.boundKeyboard(['a'], gameA);
        kb.boundKeyboard(['b'], gameB);
        kb.blockedKey(['a']);
        unblockB = kb.blockedKey(['b']);
      }, []);
      return <Text>Game</Text>;
    }
    Game.displayName = 'Game';

    clearRegistry();
    registerComponent(Menu, {});
    registerComponent(Game, {}, { parent: Menu });

    const { lastFrame, stdin } = render(
      <ScenarioManagementProvider defaultScreen={Menu}>
        <KeyboardProvider>
          <CurrentScreen />
        </KeyboardProvider>
      </ScenarioManagementProvider>,
    );

    // 进入 Game
    await press(stdin, 's');
    expect(lastFrame()).toContain('Game');

    // 两个键都被 blocked → 都穿透到 Menu
    await press(stdin, 'a');
    await press(stdin, 'b');
    expect(menuA).toHaveBeenCalledTimes(1);
    expect(menuB).toHaveBeenCalledTimes(1);
    expect(gameA).not.toHaveBeenCalled();
    expect(gameB).not.toHaveBeenCalled();

    // 仅解绑 b
    menuA.mockClear();
    menuB.mockClear();
    unblockB();

    // a 仍穿透到 Menu
    await press(stdin, 'a');
    expect(menuA).toHaveBeenCalledTimes(1);
    expect(gameA).not.toHaveBeenCalled();

    // b 恢复由 Game 截获
    await press(stdin, 'b');
    expect(gameB).toHaveBeenCalledTimes(1);
    expect(menuB).not.toHaveBeenCalled();
  });
});