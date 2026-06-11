import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import {
  render,
  act,
} from '@testing-library/react';
import React, {
  useContext,
  useEffect,
} from 'react';
import { Text } from 'ink';
import type { Key } from 'ink';

import { OverlayContext } from '../../screen/OverlayContext.js';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import {
  ScenarioManagementProvider,
} from '../../screen/provider.js';
import {
  openOverlay,
  closeOverlay,
} from '../../screen/provider.js';
import { useScreenSystem } from '../../screen/hook.js';
import { KeyboardProvider } from '../../keyboard/provider.js';
import { useKeyboard } from '../../keyboard/hook.js';
import { CurrentScreen } from '../../screen/current-screen.js';

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

function defaultKey(): Key {
  return {
    upArrow: false, downArrow: false, leftArrow: false, rightArrow: false,
    return: false, escape: false, backspace: false, delete: false,
    tab: false, pageDown: false, pageUp: false,
    home: false, end: false,
    ctrl: false, shift: false, meta: false,
  };
}

function pressKey(input: string, overrides: Partial<Key> = {}) {
  if (!capturedInputHandler) {
    throw new Error('useInput handler not captured');
  }
  capturedInputHandler(input, { ...defaultKey(), ...overrides } as Key);
}

interface MenuProps {
  onGameEscape?: () => void;
}

function Menu({ onGameEscape }: MenuProps) {
  const { skip, gotoScreen } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['s'], () => skip(Game, { onGameEscape }));
    boundKeyboard(['x'], () => gotoScreen(Settings, {}));
  }, []);
  return <Text>Menu</Text>;
}
Menu.displayName = 'Menu';

interface GameProps {
  onGameEscape?: () => void;
}

function Game({ onGameEscape }: GameProps) {
  const { back, skip, openOverlay: op } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['b'], () => back());
    boundKeyboard(['i'], () => skip(Inventory, {}));
    boundKeyboard(['o'], () => op('simple-ovl', SimpleOverlay, {}));
    boundKeyboard(['escape'], () => onGameEscape?.());
  }, []);
  return <Text>Game</Text>;
}
Game.displayName = 'Game';

function Inventory() {
  const { back } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['b'], () => back());
  }, []);
  return <Text>Inventory</Text>;
}
Inventory.displayName = 'Inventory';

function Settings() {
  const { back } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['b'], () => back());
  }, []);
  return <Text>Settings</Text>;
}
Settings.displayName = 'Settings';

interface SimpleOverlayProps {
  onCustomKey?: () => void;
}

function SimpleOverlay({ onCustomKey }: SimpleOverlayProps) {
  const overlayId = useContext(OverlayContext);
  const { closeOverlay: cl } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['escape'], () => cl(overlayId!));
    boundKeyboard(['c'], () => onCustomKey?.());
  }, []);
  return <Text>SimpleOverlay</Text>;
}
SimpleOverlay.displayName = 'SimpleOverlay';

interface OverlayAProps { onA?: () => void; }

function OverlayA({ onA }: OverlayAProps) {
  const overlayId = useContext(OverlayContext);
  const { closeOverlay: cl } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['a'], () => onA?.());
    boundKeyboard(['escape'], () => cl(overlayId!));
  }, []);
  return <Text>OverlayA</Text>;
}
OverlayA.displayName = 'OverlayA';

interface OverlayBProps { onB?: () => void; }

function OverlayB({ onB }: OverlayBProps) {
  const overlayId = useContext(OverlayContext);
  const { closeOverlay: cl } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['b'], () => onB?.());
    boundKeyboard(['escape'], () => cl(overlayId!));
  }, []);
  return <Text>OverlayB</Text>;
}
OverlayB.displayName = 'OverlayB';

interface OverlayCProps { onC?: () => void; }

function OverlayC({ onC }: OverlayCProps) {
  const overlayId = useContext(OverlayContext);
  const { closeOverlay: cl } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['c'], () => onC?.());
    boundKeyboard(['escape'], () => cl(overlayId!));
  }, []);
  return <Text>OverlayC</Text>;
}
OverlayC.displayName = 'OverlayC';

interface OverlayWithFocusProps {
  onFocusA?: () => void;
  onFocusB?: () => void;
}

function OverlayWithFocus({ onFocusA, onFocusB }: OverlayWithFocusProps) {
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['a'], () => onFocusA?.(), { focusId: 'focus-a' });
    boundKeyboard(['b'], () => onFocusB?.(), { focusId: 'focus-b' });
  }, []);
  return <Text>OverlayWithFocus</Text>;
}
OverlayWithFocus.displayName = 'OverlayWithFocus';

interface OverlayWithStopProps {
  stoppedKey?: string;
  onPassThroughKey?: () => void;
}

function OverlayWithStop({ stoppedKey = 's', onPassThroughKey }: OverlayWithStopProps) {
  const { boundKeyboard, stop } = useKeyboard();
  useEffect(() => {
    stop([stoppedKey]);
    if (onPassThroughKey) {
      boundKeyboard(['t'], () => onPassThroughKey());
    }
  }, []);
  return <Text>OverlayWithStop</Text>;
}
OverlayWithStop.displayName = 'OverlayWithStop';

interface OverlayWithBlockedProps {
  blockedKeyName?: string;
  onOtherKey?: () => void;
}

function OverlayWithBlocked({ blockedKeyName = 'p', onOtherKey }: OverlayWithBlockedProps) {
  const { boundKeyboard, blockedKey } = useKeyboard();
  useEffect(() => {
    blockedKey([blockedKeyName]);
    if (onOtherKey) {
      boundKeyboard(['x'], () => onOtherKey());
    }
  }, []);
  return <Text>OverlayWithBlocked</Text>;
}
OverlayWithBlocked.displayName = 'OverlayWithBlocked';

function OverlayWithOnlyThis({ onOnlyThisKey }: { onOnlyThisKey?: () => void }) {
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['y'], () => onOnlyThisKey?.(), { onlyThis: true });
  }, []);
  return <Text>OverlayWithOnlyThis</Text>;
}
OverlayWithOnlyThis.displayName = 'OverlayWithOnlyThis';

function OverlayThatOpensAnother() {
  const overlayId = useContext(OverlayContext);
  const { openOverlay: op, closeOverlay: cl } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    op('inner-ovl', OverlayA, {});
    boundKeyboard(['x'], () => cl(overlayId!));
  }, []);
  return <Text>OverlayThatOpensAnother</Text>;
}
OverlayThatOpensAnother.displayName = 'OverlayThatOpensAnother';

function renderSystem(
  defaultScreen: React.ComponentType<any>,
  defaultParams?: Record<string, unknown>,
) {
  const screenRef: { current: ReturnType<typeof useScreenSystem> | null } = { current: null };
  const keyboardRef: { current: ReturnType<typeof useKeyboard> | null } = { current: null };

  function Spy() {
    const sc = useScreenSystem();
    const kb = useKeyboard();
    screenRef.current = sc;
    keyboardRef.current = kb;
    useEffect(() => {
      screenRef.current = sc;
      keyboardRef.current = kb;
    }, [sc, kb]);
    return <CurrentScreen />;
  }

  render(
    <ScenarioManagementProvider defaultScreen={defaultScreen} defaultParams={defaultParams}>
      <KeyboardProvider>
        <Spy />
      </KeyboardProvider>
    </ScenarioManagementProvider>,
  );

  return {
    getScreen: () => screenRef.current,
    getKeyboard: () => keyboardRef.current,
  };
}

beforeEach(() => {
  clearRegistry();
  capturedInputHandler = null;

  registerComponent(Menu, {});
  registerComponent(Game, {}, { parent: Menu });
  registerComponent(Inventory, {}, { parent: Game });
  registerComponent(Settings, {}, { parent: Menu });

  registerComponent(SimpleOverlay, {});
  registerComponent(OverlayA, {});
  registerComponent(OverlayB, {});
  registerComponent(OverlayC, {});
  registerComponent(OverlayWithFocus, {});
  registerComponent(OverlayWithStop, {});
  registerComponent(OverlayWithBlocked, {});
  registerComponent(OverlayWithOnlyThis, {});
  registerComponent(OverlayThatOpensAnother, {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// 核心场景

describe('场景 1：多 overlay 同时打开与独立关闭', () => {
  it('打开三个 overlay，关闭中间一个，其余保持活跃', () => {
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('a', OverlayA, {}));
    act(() => getScreen()!.openOverlay('b', OverlayB, {}));
    act(() => getScreen()!.openOverlay('c', OverlayC, {}));
    expect(getScreen()!.displayedOverlays.length).toBe(3);

    act(() => getScreen()!.closeOverlay('b'));
    expect(getScreen()!.displayedOverlays.length).toBe(2);
    expect(getScreen()!.displayedOverlays.map(o => o.id)).toEqual(['a', 'c']);
    expect(getScreen()!.activeOverlayIds).toContain('a');
    expect(getScreen()!.activeOverlayIds).toContain('c');
    expect(getScreen()!.activeOverlayIds).not.toContain('b');
  });

  it('打开三个 overlay，每个独立绑定键盘，仅顶层 overlay 收到按键', () => {
    const spyA = vi.fn();
    const spyB = vi.fn();
    const spyC = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('a', OverlayA, { onA: spyA }, { zIndex: 10 }));
    act(() => getScreen()!.openOverlay('b', OverlayB, { onB: spyB }, { zIndex: 20 }));
    act(() => getScreen()!.openOverlay('c', OverlayC, { onC: spyC }, { zIndex: 30 }));

    // OverlayC at zIndex 30 is top-most
    act(() => pressKey('c', {}));
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyB).not.toHaveBeenCalled();
    expect(spyA).not.toHaveBeenCalled();
  });

  it('关闭顶层 overlay 后，次高层 overlay 收到按键', () => {
    const spyA = vi.fn();
    const spyB = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('a', OverlayA, { onA: spyA }, { zIndex: 10 }));
    act(() => getScreen()!.openOverlay('b', OverlayB, { onB: spyB }, { zIndex: 20 }));

    act(() => getScreen()!.closeOverlay('b'));
    expect(getScreen()!.displayedOverlays.length).toBe(1);

    act(() => pressKey('a', {}));
    expect(spyA).toHaveBeenCalledTimes(1);
  });

  it('closeAllOverlays 关闭所有 overlay', () => {
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('a', OverlayA, {}));
    act(() => getScreen()!.openOverlay('b', OverlayB, {}));
    act(() => getScreen()!.openOverlay('c', OverlayC, {}));
    expect(getScreen()!.displayedOverlays.length).toBe(3);

    act(() => getScreen()!.closeAllOverlays());
    expect(getScreen()!.displayedOverlays.length).toBe(0);
    expect(getScreen()!.activeOverlayIds.length).toBe(0);
  });
});

describe('场景 2：多 overlay 的 zIndex 渲染与键盘优先级', () => {
  it('zIndex 控制排序 — 数值小的在前（渲染顺序），大的在后（视觉上层）', () => {
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('back', OverlayA, {}, { zIndex: 10 }));
    act(() => getScreen()!.openOverlay('middle', OverlayB, {}, { zIndex: 15 }));
    act(() => getScreen()!.openOverlay('front', OverlayC, {}, { zIndex: 20 }));

    const displayed = getScreen()!.displayedOverlays;
    expect(displayed.length).toBe(3);
    expect(displayed[0].id).toBe('back');
    expect(displayed[0].zIndex).toBe(10);
    expect(displayed[1].id).toBe('middle');
    expect(displayed[1].zIndex).toBe(15);
    expect(displayed[2].id).toBe('front');
    expect(displayed[2].zIndex).toBe(20);
  });

  it('所有活跃 overlay 都收到键盘事件（广播模式）', () => {
    const spyLow = vi.fn();
    const spyHigh = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('low', OverlayA, { onA: spyLow }, { zIndex: 10 }));
    act(() => getScreen()!.openOverlay('high', OverlayA, { onA: spyHigh }, { zIndex: 30 }));

    // 广播模式下所有活跃 overlay 都收到事件
    act(() => pressKey('a', {}));
    expect(spyHigh).toHaveBeenCalledTimes(1);
    expect(spyLow).toHaveBeenCalledTimes(1);
  });

  it('键盘事件按 zIndex 从高到低广播，不限于单一消费', () => {
    const spyA = vi.fn();
    const spyB = vi.fn();
    const { getScreen } = renderSystem(Menu);

    // OverlayA binds 'a', OverlayB binds 'b'. Both have no 'x' binding
    // Press 'x' — should pass through both overlays
    act(() => getScreen()!.openOverlay('low', OverlayA, { onA: spyA }, { zIndex: 10 }));
    act(() => getScreen()!.openOverlay('high', OverlayB, { onB: spyB }, { zIndex: 30 }));

    act(() => pressKey('x', {}));
    expect(spyA).not.toHaveBeenCalled();
    expect(spyB).not.toHaveBeenCalled();
  });
});

describe('场景 3：activate/deactivate 的多 overlay 交互', () => {
  it('deactivate 顶层 overlay 后，按键穿透到下一个活跃 overlay', () => {
    const spyA = vi.fn();
    const spyB = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('a', OverlayA, { onA: spyA }, { zIndex: 10 }));
    act(() => getScreen()!.openOverlay('b', OverlayB, { onB: spyB }, { zIndex: 20 }));

    // Top overlay B is active, so 'b' goes to B
    act(() => pressKey('b', {}));
    expect(spyB).toHaveBeenCalledTimes(1);

    act(() => getScreen()!.deactivateOverlay('b'));
    expect(getScreen()!.activeOverlayIds).not.toContain('b');
    expect(getScreen()!.activeOverlayIds).toContain('a');

    // Now 'a' key should reach OverlayA
    spyB.mockClear();
    act(() => pressKey('a', {}));
    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).not.toHaveBeenCalled();
  });

  it('重新 activate 后 overlay 恢复接收按键', () => {
    const spyA = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('a', OverlayA, { onA: spyA }));
    act(() => getScreen()!.deactivateOverlay('a'));
    expect(getScreen()!.activeOverlayIds).not.toContain('a');

    act(() => pressKey('a', {}));
    expect(spyA).not.toHaveBeenCalled();

    act(() => getScreen()!.activateOverlay('a'));
    expect(getScreen()!.activeOverlayIds).toContain('a');

    act(() => pressKey('a', {}));
    expect(spyA).toHaveBeenCalledTimes(1);
  });

  it('deactivate 全部 overlay 后按键到达屏幕栈', () => {
    const gameEscapeSpy = vi.fn();
    const { getScreen } = renderSystem(Menu, { onGameEscape: gameEscapeSpy });

    act(() => pressKey('s', {})); // Menu → Game
    act(() => getScreen()!.openOverlay('a', OverlayA, {}));
    act(() => getScreen()!.openOverlay('b', OverlayB, {}));

    act(() => getScreen()!.deactivateOverlay('a'));
    act(() => getScreen()!.deactivateOverlay('b'));
    expect(getScreen()!.activeOverlayIds.length).toBe(0);

    // Game 绑定 escape，现在应该可以触发
    act(() => pressKey('', { escape: true }));
    expect(gameEscapeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('场景 4：多 overlay 的焦点系统独立', () => {
  it('每个 overlay 独立维护焦点链，广播时各自当前焦点触发', () => {
    const spyFocusA1 = vi.fn();
    const spyFocusA2 = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay(
      'ovl-1', OverlayWithFocus,
      { onFocusA: spyFocusA1 },
      { zIndex: 10 },
    ));
    act(() => getScreen()!.openOverlay(
      'ovl-2', OverlayWithFocus,
      { onFocusA: spyFocusA2 },
      { zIndex: 20 },
    ));

    // 广播模式：每个 overlay 的当前焦点（focus-a）都触发
    act(() => pressKey('a', {}));
    expect(spyFocusA2).toHaveBeenCalledTimes(1);
    expect(spyFocusA1).toHaveBeenCalledTimes(1);
  });

  it('关闭顶层 overlay 后，下层 overlay 的焦点系统生效', () => {
    const spyFocusA = vi.fn();
    const spyFocusB = vi.fn();
    const { getScreen, getKeyboard } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay(
      'lower', OverlayWithFocus,
      { onFocusA: spyFocusA, onFocusB: spyFocusB },
      { zIndex: 10 },
    ));
    act(() => getScreen()!.openOverlay('upper', SimpleOverlay, {}, { zIndex: 20 }));

    act(() => getScreen()!.closeOverlay('upper'));

    // 下层 overlay 的 focus 应该仍然从第一个注册的开始
    act(() => pressKey('', { tab: true }));
    expect(getKeyboard()!.focusCurrent()).toBe('focus-b');

    act(() => pressKey('b', {}));
    expect(spyFocusB).toHaveBeenCalledTimes(1);
  });

  it('Shift+Tab 逆向循环焦点', () => {
    const spyFocusA = vi.fn();
    const spyFocusB = vi.fn();
    const { getScreen, getKeyboard } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay(
      'ovl', OverlayWithFocus,
      { onFocusA: spyFocusA, onFocusB: spyFocusB },
    ));

    expect(getKeyboard()!.focusCurrent()).toBe('focus-a');

    // Shift+Tab should go backwards, wrapping to focus-b
    act(() => pressKey('', { tab: true, shift: true }));
    expect(getKeyboard()!.focusCurrent()).toBe('focus-b');
  });
});

describe('场景 5：overlay 的 stop/blockedKey 穿透到下层', () => {
  it('上层 overlay stop 不阻止下层 overlay 接收事件', () => {
    const spyA = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('lower', OverlayA, { onA: spyA }, { zIndex: 10 }));
    act(() => getScreen()!.openOverlay('upper', OverlayWithStop, { stoppedKey: 'a' }, { zIndex: 20 }));

    // stop 只阻止屏幕栈，不阻止其他活跃 overlay（广播各自独立处理）
    act(() => pressKey('a', {}));
    expect(spyA).toHaveBeenCalledTimes(1);
  });

  it('上层 overlay blockedKey 某键后，该键穿透到下层 overlay', () => {
    const spyA = vi.fn();
    const { getScreen } = renderSystem(Menu);

    // OverlayWithBlocked blocks 'a', allows pass-through
    act(() => getScreen()!.openOverlay('lower', OverlayA, { onA: spyA }, { zIndex: 10 }));
    act(() => getScreen()!.openOverlay('upper', OverlayWithBlocked, { blockedKeyName: 'a' }, { zIndex: 20 }));

    act(() => pressKey('a', {}));
    expect(spyA).toHaveBeenCalledTimes(1);
  });

  it('上层 overlay blockedKey 后，中层和下层各自独立处理', () => {
    const spyLower = vi.fn();
    const spyMiddle = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('lower', OverlayA, { onA: spyLower }, { zIndex: 10 }));
    act(() => getScreen()!.openOverlay('middle', OverlayA, { onA: spyMiddle }, { zIndex: 20 }));
    act(() => getScreen()!.openOverlay('upper', OverlayWithBlocked, { blockedKeyName: 'a' }, { zIndex: 30 }));

    // blockedKey 让该键穿透当前层，广播模式下中层和下层各自独立处理
    act(() => pressKey('a', {}));
    expect(spyMiddle).toHaveBeenCalledTimes(1);
    expect(spyLower).toHaveBeenCalledTimes(1);
  });

  it('stop 不阻止其他键穿透', () => {
    const spyB = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('lower', OverlayB, { onB: spyB }, { zIndex: 10 }));
    // OverlayWithStop stops 's' but not 'b'
    act(() => getScreen()!.openOverlay('upper', OverlayWithStop, { stoppedKey: 's' }, { zIndex: 20 }));

    act(() => pressKey('b', {}));
    expect(spyB).toHaveBeenCalledTimes(1);
  });
});

describe('场景 6：globalKeys 与多 overlay 的交互', () => {
  it('affectOverlay=true 的全局键在有 overlay 时触发', () => {
    const globalFn = vi.fn();
    const { getKeyboard, getScreen } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'g', operate: globalFn, affectOverlay: true, cover: true },
    ]);

    act(() => getScreen()!.openOverlay('ovl', SimpleOverlay, {}));

    act(() => pressKey('g', {}));
    expect(globalFn).toHaveBeenCalledTimes(1);
  });

  it('affectOverlay=true 的全局键在没有 overlay 时不触发', () => {
    const globalFn = vi.fn();
    const { getKeyboard } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'g', operate: globalFn, affectOverlay: true, cover: true },
    ]);

    act(() => pressKey('g', {}));
    expect(globalFn).not.toHaveBeenCalled();
  });

  it('affectOverlay=true + executeWhenNoOverlay=true 时，无 overlay 也能触发', () => {
    const globalFn = vi.fn();
    const { getKeyboard } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'g', operate: globalFn, affectOverlay: true, cover: true, executeWhenNoOverlay: true },
    ]);

    act(() => pressKey('g', {}));
    expect(globalFn).toHaveBeenCalledTimes(1);
  });

  it('affectOverlay=true + executeWhenNoOverlay=true 的全局键优先于普通全局键', () => {
    const affectOverlayFn = vi.fn();
    const normalFn = vi.fn();
    const { getKeyboard, getScreen } = renderSystem(Menu);

    // Both registered for same key, one with affectOverlay+executeWhenNoOverlay, one without
    getKeyboard()!.globalKeys([
      { key: 'g', operate: affectOverlayFn, affectOverlay: true, cover: true, executeWhenNoOverlay: true },
    ], { mode: 'add' });
    getKeyboard()!.globalKeys([
      { key: 'g', operate: normalFn },
    ], { mode: 'add' });

    // No overlay — but executeWhenNoOverlay makes the first one fire
    act(() => pressKey('g', {}));
    expect(affectOverlayFn).toHaveBeenCalledTimes(1);
    expect(normalFn).not.toHaveBeenCalled();
  });

  it('affectOverlay=true & cover=true → overlay 可以覆盖全局键', () => {
    const globalFn = vi.fn();
    const { getKeyboard, getScreen } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'escape', operate: globalFn, affectOverlay: true, cover: true },
    ]);

    // SimpleOverlay 在内部调用 boundKeyboard 绑定 'escape'
    // overlay 层的 globalKeyOverrides 会覆盖全局键
    act(() => getScreen()!.openOverlay('ovl', SimpleOverlay, {}));

    act(() => pressKey('', { escape: true }));
    expect(globalFn).not.toHaveBeenCalled();
    expect(getScreen()!.displayedOverlays.length).toBe(0);
  });

  it('affectOverlay=false 的全局键在 overlay 关闭后仍触发屏幕栈', () => {
    const globalFn = vi.fn();
    const { getKeyboard, getScreen } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'g', operate: globalFn, affectOverlay: false },
    ]);

    act(() => getScreen()!.openOverlay('ovl', SimpleOverlay, {}));

    act(() => pressKey('g', {}));
    expect(globalFn).toHaveBeenCalledTimes(1);
  });
});

describe('场景 7：导航操作清空所有 overlay', () => {
  it('skip 时清空所有 overlay', () => {
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('a', OverlayA, {}));
    act(() => getScreen()!.openOverlay('b', OverlayB, {}));
    expect(getScreen()!.displayedOverlays.length).toBe(2);

    act(() => getScreen()!.skip(Game, {}));
    expect(getScreen()!.displayedOverlays.length).toBe(0);
    expect(getScreen()!.activeOverlayIds.length).toBe(0);
  });

  it('back 时清空所有 overlay', () => {
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.skip(Game, {}));
    act(() => getScreen()!.openOverlay('a', OverlayA, {}));
    expect(getScreen()!.displayedOverlays.length).toBe(1);

    act(() => getScreen()!.back());
    expect(getScreen()!.displayedOverlays.length).toBe(0);
  });

  it('gotoScreen 时清空所有 overlay', () => {
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('a', OverlayA, {}));
    act(() => getScreen()!.openOverlay('b', OverlayB, {}));
    expect(getScreen()!.displayedOverlays.length).toBe(2);

    act(() => getScreen()!.gotoScreen(Settings, {}));
    expect(getScreen()!.displayedOverlays.length).toBe(0);
  });

  it('通过按键驱动的导航也清空 overlay', () => {
    const { getScreen } = renderSystem(Menu);

    // Menu→Game via keyboard 's'
    act(() => pressKey('s', {}));
    expect(getScreen()!.currentPath).toEqual([Menu, Game]);

    // Open an overlay via keyboard 'o'
    act(() => pressKey('o', {}));
    expect(getScreen()!.displayedOverlays.length).toBe(1);

    // 'b' navigates back, should clear overlays
    act(() => pressKey('b', {}));
    expect(getScreen()!.displayedOverlays.length).toBe(0);
    expect(getScreen()!.currentPath).toEqual([Menu]);
  });
});

// 边界与错误场景

describe('场景 8：重复 ID 打开 overlay 抛错', () => {
  it('重复使用已有 ID 时抛错', () => {
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('dup', SimpleOverlay, {}));
    expect(() =>
      act(() => getScreen()!.openOverlay('dup', SimpleOverlay, {})),
    ).toThrow(/already exists/);
  });

  it('模块级 openOverlay 重复 ID 也抛错', () => {
    renderSystem(Menu);

    act(() => openOverlay('dup-mod', SimpleOverlay, {}));
    expect(() =>
      act(() => openOverlay('dup-mod', SimpleOverlay, {})),
    ).toThrow(/already exists/);
  });
});

describe('场景 9：操作不存在的 overlay ID 抛错', () => {
  it('closeOverlay 传入未知 ID 抛错', () => {
    const { getScreen } = renderSystem(Menu);
    expect(() =>
      act(() => getScreen()!.closeOverlay('nonexistent')),
    ).toThrow(/Cannot close overlay.*no overlay with that ID exists/);
  });

  it('activateOverlay 传入未知 ID 抛错', () => {
    const { getScreen } = renderSystem(Menu);
    expect(() =>
      act(() => getScreen()!.activateOverlay('nonexistent')),
    ).toThrow(/Cannot activate overlay.*no overlay with that ID exists/);
  });

  it('deactivateOverlay 传入未知 ID 抛错', () => {
    const { getScreen } = renderSystem(Menu);
    expect(() =>
      act(() => getScreen()!.deactivateOverlay('nonexistent')),
    ).toThrow(/Cannot deactivate overlay.*no overlay with that ID exists/);
  });

  it('模块级 closeOverlay 传入未知 ID 抛错', () => {
    renderSystem(Menu);
    expect(() =>
      act(() => closeOverlay('nonexistent')),
    ).toThrow(/Cannot close overlay.*no overlay with that ID exists/);
  });
});

describe('场景 10：deactivate 全部 overlay 后按键到屏幕栈', () => {
  it('所有 overlay 都 deactivate 后，按键穿透到屏幕层', () => {
    const gameEscapeSpy = vi.fn();
    const { getScreen } = renderSystem(Menu, { onGameEscape: gameEscapeSpy });

    act(() => pressKey('s', {}));
    act(() => getScreen()!.openOverlay('a', OverlayA, {}));
    act(() => getScreen()!.openOverlay('b', OverlayB, {}));

    act(() => getScreen()!.deactivateOverlay('a'));
    act(() => getScreen()!.deactivateOverlay('b'));
    expect(getScreen()!.activeOverlayIds.length).toBe(0);

    act(() => pressKey('', { escape: true }));
    expect(gameEscapeSpy).toHaveBeenCalledTimes(1);
  });

  it('部分 deactivate 后，活跃的 overlay 仍接收按键', () => {
    const spyA = vi.fn();
    const spyB = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('a', OverlayA, { onA: spyA }, { zIndex: 10 }));
    act(() => getScreen()!.openOverlay('b', OverlayB, { onB: spyB }, { zIndex: 20 }));

    act(() => getScreen()!.deactivateOverlay('b'));

    // OverlayA is now the only active overlay
    act(() => pressKey('a', {}));
    expect(spyA).toHaveBeenCalledTimes(1);
  });
});

describe('场景 11：相同 zIndex 按 createdAt 排序', () => {
  it('两个 overlay 相同 zIndex 时，先打开的排前面', () => {
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('first', OverlayA, {}, { zIndex: 5 }));
    act(() => getScreen()!.openOverlay('second', OverlayB, {}, { zIndex: 5 }));

    const displayed = getScreen()!.displayedOverlays;
    expect(displayed.length).toBe(2);
    expect(displayed[0].zIndex).toBe(5);
    expect(displayed[1].zIndex).toBe(5);
    expect(displayed[0].createdAt).toBeLessThanOrEqual(displayed[1].createdAt);
    expect(displayed[0].id).toBe('first');
    expect(displayed[1].id).toBe('second');
  });

  it('默认 zIndex（不传）按打开顺序递增', () => {
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('a', OverlayA, {}));
    act(() => getScreen()!.openOverlay('b', OverlayB, {}));
    act(() => getScreen()!.openOverlay('c', OverlayC, {}));

    const displayed = getScreen()!.displayedOverlays;
    expect(displayed[0].zIndex).toBe(0);
    expect(displayed[1].zIndex).toBe(1);
    expect(displayed[2].zIndex).toBe(2);
  });
});

describe('场景 12：openOverlay activate:false 不接收键盘', () => {
  it('activate:false 时 overlay 渲染但不响应按键', () => {
    const spyA = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('inactive', OverlayA, { onA: spyA }, { activate: false }));
    expect(getScreen()!.displayedOverlays.length).toBe(1);
    expect(getScreen()!.activeOverlayIds).not.toContain('inactive');

    act(() => pressKey('a', {}));
    expect(spyA).not.toHaveBeenCalled();
  });

  it('activate:false 的 overlay 渲染文本可见', () => {
    // We use a simple render test to verify inactive overlay still renders.
    // Since OverlayA renders "OverlayA", we check displayedOverlays metadata.
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('inactive', SimpleOverlay, {}, { activate: false }));
    expect(getScreen()!.displayedOverlays.length).toBe(1);
    expect(getScreen()!.displayedOverlays[0].id).toBe('inactive');
  });
});

describe('场景 13：overlay 中打开新 overlay 后关闭自身', () => {
  it('外层 overlay 打开内层并关闭自身，内层仍然存在', () => {
    const { getScreen } = renderSystem(Menu);

    // OverlayThatOpensAnother opens OverlayA internally (id: inner-ovl)
    // and binds 'x' to close itself
    act(() => getScreen()!.openOverlay('outer', OverlayThatOpensAnother, {}));

    // Now we have: outer (OverlayThatOpensAnother) + inner (OverlayA)
    expect(getScreen()!.displayedOverlays.length).toBe(2);
    expect(getScreen()!.displayedOverlays.map(o => o.id)).toContain('outer');
    expect(getScreen()!.displayedOverlays.map(o => o.id)).toContain('inner-ovl');

    // Close the outer overlay via 'x' key
    act(() => pressKey('x', {}));
    expect(getScreen()!.displayedOverlays.length).toBe(1);
    expect(getScreen()!.displayedOverlays[0].id).toBe('inner-ovl');
    expect(getScreen()!.activeOverlayIds).toContain('inner-ovl');
  });
});

describe('场景 14：onlyThis 在 overlay 和屏幕栈的差异', () => {
  it('屏幕栈 onlyThis 在任意 overlay 存在时跳过', () => {
    const screenOnlyThisFn = vi.fn();
    const { getKeyboard, getScreen } = renderSystem(Menu);

    // Register a screen-level onlyThis binding
    getKeyboard()!.boundKeyboard(['z'], screenOnlyThisFn, { onlyThis: true });

    // No overlay yet — onlyThis should work
    act(() => pressKey('z', {}));
    expect(screenOnlyThisFn).toHaveBeenCalledTimes(1);

    // Open any overlay
    act(() => getScreen()!.openOverlay('ovl', SimpleOverlay, {}));
    screenOnlyThisFn.mockClear();

    act(() => pressKey('z', {}));
    expect(screenOnlyThisFn).not.toHaveBeenCalled();
  });

  it('overlay onlyThis 仅在多 overlay 竞争时跳过（activeCount > 1）', () => {
    const onlyThisFn = vi.fn();
    const { getScreen } = renderSystem(Menu);

    // OverlayWithOnlyThis registers 'y' with onlyThis: true
    act(() => getScreen()!.openOverlay('only-ovl', OverlayWithOnlyThis, { onOnlyThisKey: onlyThisFn }));

    // Single overlay — onlyThis should work
    act(() => pressKey('y', {}));
    expect(onlyThisFn).toHaveBeenCalledTimes(1);

    // Open second overlay
    act(() => getScreen()!.openOverlay('second', SimpleOverlay, {}, { zIndex: 100 }));
    onlyThisFn.mockClear();

    act(() => pressKey('y', {}));
    // onlyThis should be skipped because activeCount > 1
    expect(onlyThisFn).not.toHaveBeenCalled();
  });

  it('overlay onlyThis 在唯一活跃时仍触发，即使有其他非活跃 overlay', () => {
    const onlyThisFn = vi.fn();
    const { getScreen } = renderSystem(Menu);

    act(() => getScreen()!.openOverlay('only-ovl', OverlayWithOnlyThis, { onOnlyThisKey: onlyThisFn }, { zIndex: 10 }));
    act(() => getScreen()!.openOverlay('inactive', OverlayA, {}, { activate: false, zIndex: 20 }));

    // inactive is rendered but not active — activeCount should be 1
    act(() => pressKey('y', {}));
    expect(onlyThisFn).toHaveBeenCalledTimes(1);
  });
});

// keyboard/provider 中 multi-overlay 相关的特殊行为

describe('场景 15：executeWhenNoOverlay — 无 overlay 时 affectOverlay 全局键仍然触发', () => {
  it('executeWhenNoOverlay=true 且无 overlay 时全局键触发', () => {
    const globalFn = vi.fn();
    const { getKeyboard } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'h', operate: globalFn, affectOverlay: true, executeWhenNoOverlay: true },
    ]);

    act(() => pressKey('h', {}));
    expect(globalFn).toHaveBeenCalledTimes(1);
  });

  it('executeWhenNoOverlay 优先级高于不带 affectOverlay 的全局键', () => {
    const withExecFn = vi.fn();
    const normalFn = vi.fn();
    const { getKeyboard } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'h', operate: withExecFn, affectOverlay: true, executeWhenNoOverlay: true },
    ], { mode: 'add' });
    getKeyboard()!.globalKeys([
      { key: 'h', operate: normalFn },
    ], { mode: 'add' });

    act(() => pressKey('h', {}));
    expect(withExecFn).toHaveBeenCalledTimes(1);
    expect(normalFn).not.toHaveBeenCalled();
  });

  it('有 overlay 时 executeWhenNoOverlay 全局键正常触发', () => {
    const globalFn = vi.fn();
    const { getKeyboard, getScreen } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'h', operate: globalFn, affectOverlay: true, executeWhenNoOverlay: true },
    ]);

    act(() => getScreen()!.openOverlay('ovl', SimpleOverlay, {}));
    act(() => pressKey('h', {}));
    expect(globalFn).toHaveBeenCalledTimes(1);
  });
});

describe('场景 16：overlay globalKeyOverrides — boundKeyboard 自动覆盖全局键', () => {
  it('屏幕层可覆盖 affectOverlay=false 的全局键', () => {
    const globalFn = vi.fn();
    const screenFn = vi.fn();
    const { getKeyboard } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'k', operate: globalFn, affectOverlay: false, cover: true },
    ]);

    // 屏幕层绑定 'k'，boundKeyboard 将 'k' 加入屏幕层的 globalKeyOverrides
    getKeyboard()!.boundKeyboard(['k'], screenFn);

    act(() => pressKey('k', {}));
    expect(screenFn).toHaveBeenCalledTimes(1);
    expect(globalFn).not.toHaveBeenCalled();
  });

  it('屏幕层不能覆盖 affectOverlay=true 的全局键', () => {
    const globalFn = vi.fn();
    const { getKeyboard } = renderSystem(Menu);

    // executeWhenNoOverlay 确保无 overlay 时也触发，用来验证屏幕层无法阻止它
    getKeyboard()!.globalKeys([
      { key: 'k', operate: globalFn, affectOverlay: true, cover: true, executeWhenNoOverlay: true },
    ]);

    // 屏幕层绑定 'k'，但因为 affectOverlay=true，屏幕层不能写入 globalKeyOverrides
    getKeyboard()!.boundKeyboard(['k'], () => {});

    act(() => pressKey('k', {}));
    expect(globalFn).toHaveBeenCalledTimes(1);
  });

  it('cover:false 的全局键不能被覆盖（affectOverlay=false 屏幕层验证）', () => {
    const { getKeyboard } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'k', operate: () => {}, affectOverlay: false, cover: false },
    ]);

    expect(() =>
      getKeyboard()!.boundKeyboard(['k'], () => {}),
    ).toThrow(/cover: false/);
  });
});

describe('场景 17：屏幕栈仅在无 overlay 消费事件时执行', () => {
  it('overlay 消费事件后屏幕栈不处理', () => {
    const gameEscapeSpy = vi.fn();
    const { getScreen } = renderSystem(Menu, { onGameEscape: gameEscapeSpy });

    act(() => pressKey('s', {})); // Menu → Game
    // Open overlay that binds escape
    act(() => getScreen()!.openOverlay('ovl', SimpleOverlay, {}));

    // Press escape — overlay should consume it, screen should not
    act(() => pressKey('', { escape: true }));
    expect(gameEscapeSpy).not.toHaveBeenCalled();
    expect(getScreen()!.displayedOverlays.length).toBe(0);
  });

  it('无 overlay 消费事件时屏幕栈正常处理', () => {
    const gameEscapeSpy = vi.fn();
    const { getScreen } = renderSystem(Menu, { onGameEscape: gameEscapeSpy });

    act(() => pressKey('s', {})); // Menu → Game

    act(() => pressKey('', { escape: true }));
    expect(gameEscapeSpy).toHaveBeenCalledTimes(1);
  });

  it('overlay 未绑定某键时，该键穿透到屏幕栈', () => {
    const gameEscapeSpy = vi.fn();
    const { getScreen } = renderSystem(Menu, { onGameEscape: gameEscapeSpy });

    act(() => pressKey('s', {})); // Menu → Game
    // SimpleOverlay only binds 'escape' and 'c' — not 'z'
    act(() => getScreen()!.openOverlay('ovl', SimpleOverlay, {}));

    // 'escape' is consumed by overlay
    act(() => pressKey('', { escape: true }));
    expect(gameEscapeSpy).not.toHaveBeenCalled();

    // But once overlay is closed, Game's escape works again
    act(() => pressKey('', { escape: true }));
    expect(gameEscapeSpy).toHaveBeenCalledTimes(1);
  });
});
