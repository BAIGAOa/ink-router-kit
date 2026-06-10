import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { useRef, useEffect, ReactNode } from 'react';
import {
  registerComponent,
  clearRegistry,
} from '../../screen/registry.js';
import {
  ScenarioManagementProvider,
  skip,
  back,
  gotoScreen,
  openOverlay,
  closeOverlay,
  closeAllOverlays,
  activateOverlay,
  deactivateOverlay,
} from '../../screen/provider.js';
import { useScreenSystem } from '../../screen/hook.js';
import { CurrentScreen } from '../../screen/current-screen.js';

// ── 测试用组件 ────────────────────────────────────────────

function Menu({ }: {}) {
  return React.createElement('div', null, 'Menu');
}
Menu.displayName = 'Menu';

function Settings({ theme }: { theme: string }) {
  return React.createElement('div', null, theme);
}
Settings.displayName = 'Settings';

function GameLevel({ level }: { level: number }) {
  return React.createElement('div', null, String(level));
}
GameLevel.displayName = 'GameLevel';

function Combat({ enemy }: { enemy: string }) {
  return React.createElement('div', null, enemy);
}
Combat.displayName = 'Combat';

function Inventory({ items }: { items: string[] }) {
  return React.createElement('div', null, String(items?.length ?? 0));
}
Inventory.displayName = 'Inventory';

function Notification({ message }: { message: string }) {
  return React.createElement('div', null, message);
}
Notification.displayName = 'Notification';

// ── 捕获消费者（用 useEffect 保证 commit 后更新）───────────

interface CapturedScreenSystem {
  currentScreen: ReactNode;
  currentOverlays: ReactNode[];
  currentPath: React.ComponentType<any>[];
  activeOverlayIds: string[];
  displayedOverlays: { id: string; component: React.ComponentType<any>; props: Record<string, unknown>; zIndex: number; createdAt: number }[];
  skip: (comp: any, params: any, opts?: any) => void;
  back: (levels?: number) => void;
  gotoScreen: (comp: any, params: any) => void;
  openOverlay: (id: string, comp: any, params: any, opts?: any) => void;
  closeOverlay: (id: string) => void;
  closeAllOverlays: () => void;
  activateOverlay: (id: string) => void;
  deactivateOverlay: (id: string) => void;
}

function CaptureConsumer({
  onCapture,
}: {
  onCapture: (v: CapturedScreenSystem) => void;
}) {
  const ctx = useScreenSystem();
  const ref = useRef(onCapture);
  ref.current = onCapture;

  useEffect(() => {
    ref.current(ctx);
  }, [ctx]);

  return React.createElement('div', null, 'capture');
}

// ── Setup ─────────────────────────────────────────────────

beforeEach(() => {
  clearRegistry();
  registerComponent(Menu, {});
  registerComponent(Settings, { theme: 'dark' }, { parent: Menu });
  registerComponent(GameLevel, { level: 1 }, { parent: Menu });
  registerComponent(Combat, { enemy: 'goblin' }, { parent: GameLevel });
  registerComponent(Inventory, { items: [] }, { parent: GameLevel });
  registerComponent(Notification, { message: '' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 辅助：从 DOM 读取渲染内容 ─────────────────────────────

/** 直接渲染 CurrentScreen，从 DOM 检查当前屏幕文字 */
function renderAndGetText(
  defaultScreen: React.ComponentType<any>,
  defaultParams?: Record<string, unknown>,
): string | null {
  const { container } = render(
    React.createElement(
      ScenarioManagementProvider,
      { defaultScreen, defaultParams },
      React.createElement(CurrentScreen),
    ),
  );
  return container.textContent;
}

// ── 辅助：渲染并用 ref 持有 hook 返回值 ────────────────────

function renderWithRef(
  defaultScreen: React.ComponentType<any>,
  defaultParams?: Record<string, unknown>,
): {
  get: () => CapturedScreenSystem | null;
  container: HTMLElement;
} {
  const ref: { current: CapturedScreenSystem | null } = { current: null };

  function Spy() {
    const ctx = useScreenSystem();
    ref.current = ctx;
    // 用 useEffect 确保每次渲染后都能更新 ref
    useEffect(() => {
      ref.current = ctx;
    }, [ctx]);
    return React.createElement(CurrentScreen);
  }

  const { container } = render(
    React.createElement(
      ScenarioManagementProvider,
      { defaultScreen, defaultParams },
      React.createElement(Spy),
    ),
  );

  return { get: () => ref.current, container };
}

// ── 测试 ──────────────────────────────────────────────────

describe('ScenarioManagementProvider（默认屏幕）', () => {
  it('使用 defaultScreen 渲染初始屏幕', () => {
    const text = renderAndGetText(Menu);
    expect(text).toContain('Menu');
  });

  it('defaultParams 传递到组件', () => {
    // 用一个会渲染 props 的组件来验证
    function Echo({ value }: { value: string }) {
      return React.createElement('div', null, value);
    }
    Echo.displayName = 'Echo';
    registerComponent(Echo, { value: '' }, { parent: Menu });

    const { get } = renderWithRef(Menu);
    act(() => get()!.skip(Echo, {}));
    // 验证 defaultParams 被 merge 进了渲染的 props
    const el = get()!.currentScreen as React.ReactElement;
    expect(el.type).toBe(Echo);
    expect(el.props).toMatchObject({ value: '' });
  });

  it('未传 defaultParams 时使用注册模板', () => {
    const text = renderAndGetText(GameLevel);
    expect(text).toContain('1'); // GameLevel 模板 { level: 1 }
  });

  it('defaultScreen 未注册时抛错', () => {
    function Unregistered() {
      return React.createElement('div', null, 'x');
    }
    expect(() =>
      render(
        React.createElement(
          ScenarioManagementProvider,
          { defaultScreen: Unregistered as any },
          React.createElement('div', null),
        ),
      ),
    ).toThrow('is not registered');
  });

  it('currentPath 初始为 [defaultScreen]', () => {
    const { get } = renderWithRef(Menu);
    expect(get()!.currentPath).toEqual([Menu]);
  });
});

describe('skip（沿树向下）', () => {
  it('skip 到子节点：路径增加，渲染更新', () => {
    const { get } = renderWithRef(Menu);

    act(() => {
      get()!.skip(GameLevel, { level: 2 });
    });

    const ctx = get()!;
    expect(ctx.currentPath).toEqual([Menu, GameLevel]);
    expect((ctx.currentScreen as React.ReactElement).type).toBe(GameLevel);
    expect((ctx.currentScreen as React.ReactElement).props).toMatchObject({ level: 2 });
  });

  it('skip 到孙子节点：路径继续加深', () => {
    const { get } = renderWithRef(Menu);

    act(() => {
      get()!.skip(GameLevel, { level: 1 });
    });
    act(() => {
      get()!.skip(Combat, { enemy: 'dragon' });
    });

    const ctx = get()!;
    expect(ctx.currentPath).toEqual([Menu, GameLevel, Combat]);
    expect((ctx.currentScreen as React.ReactElement).type).toBe(Combat);
    expect((ctx.currentScreen as React.ReactElement).props).toMatchObject({ enemy: 'dragon' });
  });

  it('skip 到非子节点抛错（严格沿树走）', () => {
    const { get } = renderWithRef(Menu);
    expect(() =>
      act(() => {
        get()!.skip(Combat, { enemy: 'x' });
      }),
    ).toThrow('is not a child of');
  });
});

describe('back（沿树向上）', () => {
  it('从子节点返回父节点', () => {
    const { get } = renderWithRef(Menu);

    act(() => {
      get()!.skip(GameLevel, { level: 1 });
    });
    act(() => {
      get()!.back();
    });

    expect(get()!.currentPath).toEqual([Menu]);
    expect((get()!.currentScreen as React.ReactElement).type).toBe(Menu);
  });

  it('从孙子节点返回父节点', () => {
    const { get } = renderWithRef(Menu);

    act(() => get()!.skip(GameLevel, { level: 1 }));
    act(() => get()!.skip(Combat, { enemy: 'goblin' }));
    act(() => get()!.back());

    expect(get()!.currentPath).toEqual([Menu, GameLevel]);
    expect((get()!.currentScreen as React.ReactElement).type).toBe(GameLevel);
  });

  it('根节点调用 back 抛错', () => {
    const { get } = renderWithRef(Menu);
    expect(() => act(() => get()!.back())).toThrow('already at the root node');
  });

  it('模块级 back 行为一致', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.skip(GameLevel, { level: 1 }));
    act(() => back());
    expect(get()!.currentPath).toEqual([Menu]);
  });

  it('back(2) 一次回退两层', () => {
    const { get } = renderWithRef(Menu);

    act(() => get()!.skip(GameLevel, { level: 1 }));
    act(() => get()!.skip(Combat, { enemy: 'goblin' }));
    expect(get()!.currentPath).toEqual([Menu, GameLevel, Combat]);

    act(() => get()!.back(2));
    expect(get()!.currentPath).toEqual([Menu]);
  });

  it('back(1) 等价于无参 back()', () => {
    const { get } = renderWithRef(Menu);

    act(() => get()!.skip(GameLevel, { level: 1 }));
    act(() => get()!.skip(Combat, { enemy: 'goblin' }));
    act(() => get()!.back(1));

    expect(get()!.currentPath).toEqual([Menu, GameLevel]);
  });

  it('back(0) 抛错', () => {
    const { get } = renderWithRef(Menu);

    act(() => get()!.skip(GameLevel, { level: 1 }));
    expect(() => act(() => get()!.back(0))).toThrow('levels must be >= 1');
  });

  it('back(n) 超过当前深度时抛错', () => {
    const { get } = renderWithRef(Menu);

    act(() => get()!.skip(GameLevel, { level: 1 }));
    expect(() => act(() => get()!.back(5))).toThrow(/cannot go back/);
  });
});

describe('gotoScreen（跨分支跳转）', () => {
  it('跨分支跳转：从 Combat 到 Settings', () => {
    const { get } = renderWithRef(Menu);

    act(() => get()!.skip(GameLevel, { level: 1 }));
    act(() => get()!.skip(Combat, { enemy: 'goblin' }));
    act(() => get()!.gotoScreen(Settings, { theme: 'light' }));

    expect(get()!.currentPath).toEqual([Menu, Settings]);
    expect((get()!.currentScreen as React.ReactElement).type).toBe(Settings);
    expect((get()!.currentScreen as React.ReactElement).props).toMatchObject({ theme: 'light' });
  });

  it('gotoScreen 到未注册组件抛错', () => {
    function Ghost() {
      return React.createElement('div', null);
    }
    const { get } = renderWithRef(Menu);
    expect(() =>
      act(() => {
        get()!.gotoScreen(Ghost as any, {});
      }),
    ).toThrow('is not registered');
  });

  it('模块级 gotoScreen 行为一致', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.skip(GameLevel, { level: 1 }));
    act(() => gotoScreen(Settings, { theme: 'solarized' }));
    expect(get()!.currentPath).toEqual([Menu, Settings]);
  });
});

describe('overlay（多浮层）', () => {
  it('打开 overlay 不影响 currentPath', () => {
    const { get } = renderWithRef(Menu);
    const pathBefore = [...get()!.currentPath];

    act(() => get()!.openOverlay('notif-1', Notification, { message: 'hello' }));

    const ctx = get()!;
    expect(ctx.currentPath).toEqual(pathBefore);
    expect(ctx.currentOverlays.length).toBeGreaterThan(0);
    expect(ctx.displayedOverlays.length).toBe(1);
    expect(ctx.displayedOverlays[0].id).toBe('notif-1');
    expect(ctx.activeOverlayIds).toContain('notif-1');
  });

  it('closeOverlay 通过 ID 关闭浮层', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.openOverlay('n1', Notification, { message: 'test' }));
    expect(get()!.displayedOverlays.length).toBe(1);

    act(() => get()!.closeOverlay('n1'));
    expect(get()!.displayedOverlays.length).toBe(0);
  });

  it('closeAllOverlays 关闭所有浮层', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.openOverlay('n1', Notification, { message: 'a' }));
    act(() => get()!.openOverlay('n2', Notification, { message: 'b' }));
    expect(get()!.displayedOverlays.length).toBe(2);

    act(() => get()!.closeAllOverlays());
    expect(get()!.displayedOverlays.length).toBe(0);
  });

  it('skip 时自动清空所有浮层', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.openOverlay('n1', Notification, { message: 'x' }));
    expect(get()!.displayedOverlays.length).toBe(1);

    act(() => get()!.skip(GameLevel, { level: 1 }));
    expect(get()!.displayedOverlays.length).toBe(0);
  });

  it('back 时自动清空所有浮层', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.skip(GameLevel, { level: 1 }));
    act(() => get()!.openOverlay('n1', Notification, { message: 'y' }));
    expect(get()!.displayedOverlays.length).toBe(1);

    act(() => get()!.back());
    expect(get()!.displayedOverlays.length).toBe(0);
  });

  it('gotoScreen 时自动清空所有浮层', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.skip(GameLevel, { level: 1 }));
    act(() => get()!.openOverlay('n1', Notification, { message: 'z' }));
    expect(get()!.displayedOverlays.length).toBe(1);

    act(() => get()!.gotoScreen(Settings, { theme: 'dark' }));
    expect(get()!.displayedOverlays.length).toBe(0);
  });

  it('模块级 openOverlay/closeOverlay 行为一致', () => {
    const { get } = renderWithRef(Menu);
    act(() => openOverlay('mod-1', Notification, { message: 'mod' }));
    expect(get()!.displayedOverlays.length).toBe(1);
    expect(get()!.displayedOverlays[0].id).toBe('mod-1');

    act(() => closeOverlay('mod-1'));
    expect(get()!.displayedOverlays.length).toBe(0);
  });

  it('重复 ID 的 openOverlay 抛错', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.openOverlay('dup', Notification, { message: 'first' }));
    expect(() =>
      act(() => get()!.openOverlay('dup', Notification, { message: 'second' })),
    ).toThrow(/already exists/);
  });

  it('activate/deactivate 控制浮层激活状态', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.openOverlay('n1', Notification, { message: 'test' }, { activate: true }));
    expect(get()!.activeOverlayIds).toContain('n1');

    act(() => get()!.deactivateOverlay('n1'));
    expect(get()!.activeOverlayIds).not.toContain('n1');

    act(() => get()!.activateOverlay('n1'));
    expect(get()!.activeOverlayIds).toContain('n1');
  });

  it('closeOverlay 传入未知 ID 时抛错', () => {
    const { get } = renderWithRef(Menu);
    expect(() =>
      act(() => get()!.closeOverlay('nonexistent')),
    ).toThrow(/Cannot close overlay.*no overlay with that ID exists/);
  });

  it('activateOverlay 传入未知 ID 时抛错', () => {
    const { get } = renderWithRef(Menu);
    expect(() =>
      act(() => get()!.activateOverlay('nonexistent')),
    ).toThrow(/Cannot activate overlay.*no overlay with that ID exists/);
  });

  it('deactivateOverlay 传入未知 ID 时抛错', () => {
    const { get } = renderWithRef(Menu);
    expect(() =>
      act(() => get()!.deactivateOverlay('nonexistent')),
    ).toThrow(/Cannot deactivate overlay.*no overlay with that ID exists/);
  });

  it('模块级 closeOverlay 传入未知 ID 时抛错', () => {
    renderWithRef(Menu);
    expect(() =>
      act(() => closeOverlay('nonexistent')),
    ).toThrow(/Cannot close overlay.*no overlay with that ID exists/);
  });

  it('模块级 activateOverlay/deactivateOverlay 行为一致', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.openOverlay('n1', Notification, { message: 'test' }));
    act(() => deactivateOverlay('n1'));
    expect(get()!.activeOverlayIds).not.toContain('n1');
    act(() => activateOverlay('n1'));
    expect(get()!.activeOverlayIds).toContain('n1');
  });

  it('openOverlay activate:false 时打开但不激活', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.openOverlay('n1', Notification, { message: 'x' }, { activate: false }));
    expect(get()!.displayedOverlays.length).toBe(1);
    expect(get()!.activeOverlayIds).not.toContain('n1');
  });

  it('zIndex 控制浮层排序（数值大在上层）', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.openOverlay('back', Notification, { message: 'behind' }, { zIndex: 10 }));
    act(() => get()!.openOverlay('front', Notification, { message: 'ahead' }, { zIndex: 20 }));
    act(() => get()!.openOverlay('middle', Notification, { message: 'mid' }, { zIndex: 15 }));

    const displayed = get()!.displayedOverlays;
    expect(displayed.length).toBe(3);
    // Sorted by zIndex ascending: 10, 15, 20
    expect(displayed[0].id).toBe('back');
    expect(displayed[1].id).toBe('middle');
    expect(displayed[2].id).toBe('front');
  });

  it('相同 zIndex 时按 createdAt 时间戳排序', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.openOverlay('first', Notification, { message: '1st' }, { zIndex: 5 }));
    act(() => get()!.openOverlay('second', Notification, { message: '2nd' }, { zIndex: 5 }));

    const displayed = get()!.displayedOverlays;
    expect(displayed.length).toBe(2);
    expect(displayed[0].zIndex).toBe(5);
    expect(displayed[1].zIndex).toBe(5);
    expect(displayed[0].createdAt).toBeLessThanOrEqual(displayed[1].createdAt);
    // Earlier created comes first
    expect(displayed[0].id).toBe('first');
    expect(displayed[1].id).toBe('second');
  });

  it('多个不同组件的浮层可以同时打开', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.openOverlay('notif-1', Notification, { message: 'a' }));
    act(() => get()!.openOverlay('notif-2', Notification, { message: 'b' }));
    act(() => get()!.openOverlay('inv-1', Inventory, { items: ['sword', 'shield'] }));

    const displayed = get()!.displayedOverlays;
    expect(displayed.length).toBe(3);
    expect(displayed.map(d => d.id).sort()).toEqual(['inv-1', 'notif-1', 'notif-2']);
    expect(get()!.activeOverlayIds.length).toBe(3);
  });

  it('关闭一个浮层后其他浮层不受影响', () => {
    const { get } = renderWithRef(Menu);
    act(() => get()!.openOverlay('a', Notification, { message: 'A' }));
    act(() => get()!.openOverlay('b', Notification, { message: 'B' }));
    act(() => get()!.openOverlay('c', Notification, { message: 'C' }));

    act(() => get()!.closeOverlay('b'));
    expect(get()!.displayedOverlays.length).toBe(2);
    expect(get()!.displayedOverlays.map(d => d.id)).toEqual(['a', 'c']);
    expect(get()!.activeOverlayIds.includes('b')).toBe(false);
    expect(get()!.activeOverlayIds.includes('a')).toBe(true);
    expect(get()!.activeOverlayIds.includes('c')).toBe(true);
  });
});

describe('CurrentScreen 组件', () => {
  it('无 overlay 时只渲染栈顶屏幕', () => {
    const text = renderAndGetText(Menu);
    expect(text).toContain('Menu');
  });

  it('有 overlay 时同时渲染多层', () => {
    function TestOverlay() {
      const { openOverlay: op } = useScreenSystem();
      useEffect(() => {
        op('popup-1', Notification, { message: 'popup!' });
      }, []);
      return React.createElement(CurrentScreen);
    }

    const { container } = render(
      React.createElement(
        ScenarioManagementProvider,
        { defaultScreen: Menu, children: React.createElement(TestOverlay) },
      ),
    );
    expect(container.textContent).toContain('Menu');
    expect(container.textContent).toContain('popup!');
  });
});

describe('模块级函数错误处理', () => {
  it('Provider 未挂载时 skip 抛错', () => {
    expect(() => skip(Menu, {})).toThrow(/called before Provider is mounted/);
  });
  it('Provider 未挂载时 back 抛错', () => {
    expect(() => back()).toThrow(/called before Provider is mounted/);
  });
  it('Provider 未挂载时 gotoScreen 抛错', () => {
    expect(() => gotoScreen(Menu, {})).toThrow(/called before Provider is mounted/);
  });
  it('Provider 未挂载时 openOverlay 抛错', () => {
    expect(() => openOverlay('test', Notification, { message: '' })).toThrow(/called before Provider is mounted/);
  });
  it('Provider 未挂载时 closeOverlay 抛错', () => {
    expect(() => closeOverlay('test')).toThrow(/called before Provider is mounted/);
  });
  it('Provider 未挂载时 closeAllOverlays 抛错', () => {
    expect(() => closeAllOverlays()).toThrow(/called before Provider is mounted/);
  });
});
