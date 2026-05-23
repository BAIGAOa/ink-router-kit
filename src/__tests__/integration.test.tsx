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
  useEffect,
} from 'react';
import type {
  Key,
} from 'ink';

import { CurrentScreen } from '../screen/current-screen.js';
import {
  registerComponent,
  clearRegistry,
} from '../screen/registry.js';
import {
  ScenarioManagementProvider,
} from '../screen/provider.js';
import {
  useScreenSystem,
} from '../screen/hook.js';
import {
  KeyboardProvider,
} from '../keyboard/provider.js';
import {
  useKeyboard,
} from '../keyboard/hook.js';

// Mock useInput from ink — same pattern as existing unit tests.
// Captures the handler so we can simulate key presses without a real terminal.

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

// Test components.
// Each component binds keys and declares navigation behavior in useEffect.
// Spies are injected via props so tests can observe handler calls.

interface MenuProps {
  onMenuE?: () => void;
  onMenuQ?: () => void;
  gameEscapeSpy?: () => void;
}

function Menu({ onMenuE, onMenuQ, gameEscapeSpy }: MenuProps) {
  const { skip, gotoScreen } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    boundKeyboard(['s'], () => skip(Game, { onEscape: gameEscapeSpy }));
    boundKeyboard(['e'], () => onMenuE?.());
    boundKeyboard(['q'], () => onMenuQ?.());
    boundKeyboard(['x'], () => gotoScreen(Settings, {}));
  }, []);
  return React.createElement('div', null, 'Menu');
}
Menu.displayName = 'Menu';

interface GameProps {
  onEscape?: () => void;
}

function Game({ onEscape }: GameProps) {
  const { back, skip, overlay: ov } = useScreenSystem();
  const { boundKeyboard, blockedKey, stop } = useKeyboard();

  useEffect(() => {
    blockedKey(['e']);
    stop(['q']);
    boundKeyboard(['b'], () => back());
    boundKeyboard(['i'], () => skip(Inventory, {}));
    boundKeyboard(['o'], () => ov(PauseOverlay, {}));
    // For scenario 5: Game binds escape, but overlay's escape should win.
    boundKeyboard(['escape'], () => onEscape?.());
  }, []);
  return React.createElement('div', null, 'Game');
}
Game.displayName = 'Game';

function Inventory() {
  const { back } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    boundKeyboard(['b'], () => back());
  }, []);
  return React.createElement('div', null, 'Inventory');
}
Inventory.displayName = 'Inventory';

function PauseOverlay() {
  const { closeOverlay } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    boundKeyboard(['escape'], () => closeOverlay());
  }, []);
  return React.createElement('div', null, 'PauseOverlay');
}
PauseOverlay.displayName = 'PauseOverlay';

function Settings() {
  const { back } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    boundKeyboard(['b'], () => back());
    boundKeyboard(['1'], () => {}, { focusId: 'name-input' });
    boundKeyboard(['2'], () => {}, { focusId: 'difficulty-select' });
  }, []);
  return React.createElement('div', null, 'Settings');
}
Settings.displayName = 'Settings';

// Render helper — mounts both providers and captures hook APIs via refs.
// CurrentScreen is rendered so that screen component effects actually run.

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
    return React.createElement(CurrentScreen);
  }

  render(
    React.createElement(
      ScenarioManagementProvider,
      { defaultScreen, defaultParams },
      React.createElement(KeyboardProvider, null, React.createElement(Spy)),
    ),
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
  registerComponent(PauseOverlay, {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('场景 1：基础全流程 — 按键驱动 skip / back', () => {
  it('Menu → Game → Menu', () => {
    const { getScreen } = renderSystem(Menu);

    expect(getScreen()!.currentPath).toEqual([Menu]);

    act(() => pressKey('s', {}));
    expect(getScreen()!.currentPath).toEqual([Menu, Game]);

    act(() => pressKey('b', {}));
    expect(getScreen()!.currentPath).toEqual([Menu]);
  });

  it('Menu → Game → Inventory → Game', () => {
    const { getScreen } = renderSystem(Menu);

    act(() => pressKey('s', {}));
    act(() => pressKey('i', {}));
    expect(getScreen()!.currentPath).toEqual([Menu, Game, Inventory]);

    act(() => pressKey('b', {}));
    expect(getScreen()!.currentPath).toEqual([Menu, Game]);
  });
});

describe('场景 2：责任链冒泡 — 栈顶无绑定则下层处理', () => {
  it('Inventory 和 Game 未绑 e，Menu 的 e 触发', () => {
    const menuE = vi.fn();
    const { getScreen } = renderSystem(Menu, { onMenuE: menuE });

    act(() => pressKey('s', {}));
    act(() => pressKey('i', {}));
    expect(getScreen()!.currentPath).toEqual([Menu, Game, Inventory]);

    act(() => pressKey('e', {}));
    expect(menuE).toHaveBeenCalledTimes(1);
  });
});

describe('场景 3：blockedKey 穿透', () => {
  it('Game blockedKey e，Menu 的 e 仍触发', () => {
    const menuE = vi.fn();
    const { getScreen } = renderSystem(Menu, { onMenuE: menuE });

    act(() => pressKey('s', {}));
    expect(getScreen()!.currentPath).toEqual([Menu, Game]);

    act(() => pressKey('e', {}));
    expect(menuE).toHaveBeenCalledTimes(1);
  });
});

describe('场景 4：stop 阻断 — q 被 Game 拦截', () => {
  it('Game stop q，Menu 的 q 不触发', () => {
    const menuQ = vi.fn();
    const { getScreen } = renderSystem(Menu, { onMenuQ: menuQ });

    act(() => pressKey('s', {}));
    expect(getScreen()!.currentPath).toEqual([Menu, Game]);

    act(() => pressKey('q', {}));
    expect(menuQ).not.toHaveBeenCalled();
  });
});

describe('场景 5：Overlay 优先级 — overlay 的 escape 优先于屏幕', () => {
  it('overlay 打开时按 Escape，overlay 关闭，Game 的 escape 不触发', () => {
    const gameEscapeSpy = vi.fn();
    const { getScreen } = renderSystem(Menu, { gameEscapeSpy });

    act(() => pressKey('s', {}));
    expect(getScreen()!.currentPath).toEqual([Menu, Game]);

    act(() => pressKey('o', {}));
    expect(getScreen()!.currentOverlay).not.toBeNull();
    expect(getScreen()!.currentPath).toEqual([Menu, Game]);

    act(() => pressKey('', { escape: true }));

    expect(getScreen()!.currentOverlay).toBeNull();
    expect(gameEscapeSpy).not.toHaveBeenCalled();
  });

  it('overlay 关闭后，Game 的 escape 正常工作', () => {
    const gameEscapeSpy = vi.fn();
    const { getScreen } = renderSystem(Menu, { gameEscapeSpy });

    act(() => pressKey('s', {}));

    act(() => getScreen()!.overlay(PauseOverlay, {}));
    expect(getScreen()!.currentOverlay).not.toBeNull();

    act(() => getScreen()!.closeOverlay());
    expect(getScreen()!.currentOverlay).toBeNull();

    act(() => pressKey('', { escape: true }));
    expect(gameEscapeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('场景 6：GlobalKeys — cover 字段', () => {
  it('cover: false 时 boundKeyboard 抛错', () => {
    const { getKeyboard } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'z', operate: () => {}, cover: false },
    ]);

    expect(() => {
      getKeyboard()!.boundKeyboard(['z'], () => {});
    }).toThrow('cover: false');
  });

  it('cover: true 时屏幕可以覆盖全局键，全局键不触发', () => {
    const globalFn = vi.fn();
    const screenFn = vi.fn();
    const { getKeyboard } = renderSystem(Menu);

    getKeyboard()!.globalKeys([
      { key: 'z', operate: globalFn, cover: true },
    ]);
    getKeyboard()!.boundKeyboard(['z'], screenFn);

    act(() => pressKey('z', {}));
    expect(screenFn).toHaveBeenCalledTimes(1);
    expect(globalFn).not.toHaveBeenCalled();
  });
});

describe('场景 7：Focus — Tab 切换 focus target', () => {
  it('Tab 正向循环', () => {
    const { getScreen, getKeyboard } = renderSystem(Menu);

    act(() => getScreen()!.gotoScreen(Settings, {}));
    expect(getScreen()!.currentPath).toEqual([Menu, Settings]);

    expect(getKeyboard()!.focusCurrent()).toBe('name-input');

    act(() => pressKey('', { tab: true }));
    expect(getKeyboard()!.focusCurrent()).toBe('difficulty-select');

    act(() => pressKey('', { tab: true }));
    expect(getKeyboard()!.focusCurrent()).toBe('name-input');
  });

  it('Shift+Tab 逆向', () => {
    const { getScreen, getKeyboard } = renderSystem(Menu);

    act(() => getScreen()!.gotoScreen(Settings, {}));

    expect(getKeyboard()!.focusCurrent()).toBe('name-input');

    act(() => pressKey('', { tab: true, shift: true }));
    expect(getKeyboard()!.focusCurrent()).toBe('difficulty-select');
  });

  it('focusSet 直接切换', () => {
    const { getScreen, getKeyboard } = renderSystem(Menu);

    act(() => getScreen()!.gotoScreen(Settings, {}));

    getKeyboard()!.focusSet('difficulty-select');
    expect(getKeyboard()!.focusCurrent()).toBe('difficulty-select');
  });
});