import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React, { useEffect } from 'react';
import { Text } from 'ink';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { CurrentScreen } from '../../screen/current-screen.js';
import { KeyboardProvider, clearShortcutOperations } from '../../keyboard/provider.js';
import { useKeyboard } from '../../keyboard/hook.js';

// ── 按键常量（仅用于 stdin.write，不用于 boundKeyboard）──

const KEYS = {
  enter: '\r',
  escape: '\x1b',
  up: '\x1b[A',
  down: '\x1b[B',
} as const;

// ── 辅助函数 ─────────────────────────────────────────────

async function flush() {
  await new Promise((r) => setTimeout(r, 10));
}

async function press(
  stdin: { write: (data: string) => void },
  key: string,
) {
  stdin.write(key);
  await new Promise((r) => setTimeout(r, 10));
}

function stubAction(name: string) {
  return vi.fn().mockName(name);
}

// ── Render 辅助：成功路径（ink-testing-library）────────

function renderShortcutSuccess(config: {
  shortcuts?: { actionId: string }[];
  screenBinds?: { keys: string[]; actionId: string }[];
  globalBinds?: { key: string | string[]; operate: string }[];
}) {
  const allIds = new Set<string>();
  config.shortcuts?.forEach((s) => allIds.add(s.actionId));
  config.screenBinds?.forEach((b) => allIds.add(b.actionId));
  config.globalBinds?.forEach((b) => {
    if (typeof b.operate === 'string') allIds.add(b.operate);
  });

  const spies = new Map<string, ReturnType<typeof vi.fn>>();
  for (const id of allIds) {
    spies.set(id, stubAction(id));
  }

  function HostScreen() {
    const kb = useKeyboard();

    useEffect(() => {
      // 1. 注册 shortcuts
      if (config.shortcuts && config.shortcuts.length > 0) {
        kb.defineShortcutAction(
          config.shortcuts.map((s) => ({
            actionId: s.actionId,
            action: spies.get(s.actionId)!,
          })),
        );
      }

      // 2. 屏幕级绑定（string 模式）
      for (const bind of config.screenBinds ?? []) {
        kb.boundKeyboard(bind.keys, bind.actionId);
      }

      // 3. 全局键（string operate 模式）
      if (config.globalBinds && config.globalBinds.length > 0) {
        kb.globalKeys(
          config.globalBinds.map((g) => ({
            key: g.key,
            operate: g.operate,
          }) as any),
        );
      }
    }, []);

    return <Text>ShortcutTest</Text>;
  }
  HostScreen.displayName = 'ShortcutHost';

  clearRegistry();
  registerComponent(HostScreen, {});

  const { lastFrame, stdin, unmount } = render(
    <ScenarioManagementProvider defaultScreen={HostScreen}>
      <KeyboardProvider>
        <CurrentScreen />
      </KeyboardProvider>
    </ScenarioManagementProvider>,
  );

  return { lastFrame, stdin, unmount, spies };
}

// ── Render 辅助：API 直调（错误路径用）─────────────────

function renderKeyboardApi() {
  const kbRef: { current: ReturnType<typeof useKeyboard> | null } = {
    current: null,
  };

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

// ── Cleanup ───────────────────────────────────────────────

beforeEach(() => {
  clearRegistry();
  clearShortcutOperations();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════
// 1. defineShortcutAction
// ═══════════════════════════════════════════════════════════

describe('defineShortcutAction', () => {
  it('正常注册不抛错', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    expect(() => {
      kbRef.current!.defineShortcutAction([
        { actionId: 'act-1', action: vi.fn() },
      ]);
    }).not.toThrow();
  });

  it('重复 actionId 注册抛错', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    kbRef.current!.defineShortcutAction([
      { actionId: 'dup', action: vi.fn() },
    ]);

    expect(() => {
      kbRef.current!.defineShortcutAction([
        { actionId: 'dup', action: vi.fn() },
      ]);
    }).toThrow(/dup/);
  });

  it('可同时注册多个不同的 shortcut', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    expect(() => {
      kbRef.current!.defineShortcutAction([
        { actionId: 'a', action: vi.fn() },
        { actionId: 'b', action: vi.fn() },
        { actionId: 'c', action: vi.fn() },
      ]);
    }).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════
// 2. boundKeyboard + shortcut（string handler）
// ═══════════════════════════════════════════════════════════

describe('boundKeyboard + shortcut', () => {
  it('已注册的 actionId：按键触发对应 action', async () => {
    const { stdin, spies } = renderShortcutSuccess({
      shortcuts: [{ actionId: 'confirm' }],
      screenBinds: [{ keys: ['return'], actionId: 'confirm' }],
    });

    await press(stdin, KEYS.enter);

    expect(spies.get('confirm')).toHaveBeenCalledTimes(1);
  });

  it('未注册的 actionId：调用 boundKeyboard 时抛错', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    expect(() => {
      kbRef.current!.boundKeyboard(['x'], 'no-such-action');
    }).toThrow(/no-such-action/);
  });

  it('shortcut 在 boundKeyboard 之后注册：先抛错，后注册再绑成功', async () => {
    const { kbRef, stdin } = renderKeyboardApi();
    await flush();

    // 未注册 → 抛错
    expect(() => {
      kbRef.current!.boundKeyboard(['x'], 'late');
    }).toThrow(/late/);

    // 注册 shortcut
    const spy = stubAction('late');
    kbRef.current!.defineShortcutAction([{ actionId: 'late', action: spy }]);

    // 再次绑定 → 成功
    kbRef.current!.boundKeyboard(['x'], 'late');

    // 按键触发
    await press(stdin, 'x');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. globalKeys + shortcut（string operate）
// ═══════════════════════════════════════════════════════════

describe('globalKeys + shortcut', () => {
  it('已注册的 actionId：全局键触发对应 action', async () => {
    const { stdin, spies } = renderShortcutSuccess({
      shortcuts: [{ actionId: 'global-e' }],
      globalBinds: [{ key: 'e', operate: 'global-e' }],
    });

    await press(stdin, 'e');

    expect(spies.get('global-e')).toHaveBeenCalledTimes(1);
  });

  it('未注册的 actionId：调用 globalKeys 时抛错', async () => {
    const { kbRef } = renderKeyboardApi();
    await flush();

    expect(() => {
      kbRef.current!.globalKeys([{ key: 'e', operate: 'ghost' } as any]);
    }).toThrow(/ghost/);
  });
});

// ═══════════════════════════════════════════════════════════
// 4. 组合场景
// ═══════════════════════════════════════════════════════════

describe('组合场景', () => {
  it('同一个 shortcut 绑定到多个按键，都触发同一个 action', async () => {
    const { stdin, spies } = renderShortcutSuccess({
      shortcuts: [{ actionId: 'multi' }],
      screenBinds: [
        { keys: ['a'], actionId: 'multi' },
        { keys: ['b'], actionId: 'multi' },
        { keys: ['c'], actionId: 'multi' },
      ],
    });

    await press(stdin, 'a');
    await press(stdin, 'b');
    await press(stdin, 'c');

    expect(spies.get('multi')).toHaveBeenCalledTimes(3);
  });

  it('shortcut + 普通 handler 混合，各自独立工作', async () => {
    const normalHandler = vi.fn();
    const { kbRef, stdin } = renderKeyboardApi();
    await flush();

    const shortcutSpy = stubAction('mixed');
    kbRef.current!.defineShortcutAction([
      { actionId: 'mixed', action: shortcutSpy },
    ]);

    kbRef.current!.boundKeyboard(['a'], 'mixed');
    kbRef.current!.boundKeyboard(['b'], normalHandler);

    await press(stdin, 'a');
    await press(stdin, 'b');

    expect(shortcutSpy).toHaveBeenCalledTimes(1);
    expect(normalHandler).toHaveBeenCalledTimes(1);
  });

  it('shortcut 同时用于屏幕绑定和全局键', async () => {
    const { stdin, spies } = renderShortcutSuccess({
      shortcuts: [{ actionId: 'shared' }],
      screenBinds: [{ keys: ['return'], actionId: 'shared' }],
      globalBinds: [{ key: 'e', operate: 'shared' }],
    });

    await press(stdin, KEYS.enter);
    expect(spies.get('shared')).toHaveBeenCalledTimes(1);

    await press(stdin, 'e');
    expect(spies.get('shared')).toHaveBeenCalledTimes(2);
  });

  it('defineShortcutAction 注册多个 shortcut，分别绑定不同按键', async () => {
    const { stdin, spies } = renderShortcutSuccess({
      shortcuts: [
        { actionId: 'alpha' },
        { actionId: 'beta' },
        { actionId: 'gamma' },
      ],
      screenBinds: [
        { keys: ['a'], actionId: 'alpha' },
        { keys: ['b'], actionId: 'beta' },
        { keys: ['c'], actionId: 'gamma' },
      ],
    });

    await press(stdin, 'a');
    await press(stdin, 'b');
    await press(stdin, 'c');

    expect(spies.get('alpha')).toHaveBeenCalledTimes(1);
    expect(spies.get('beta')).toHaveBeenCalledTimes(1);
    expect(spies.get('gamma')).toHaveBeenCalledTimes(1);
  });
});
