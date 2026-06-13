import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { useEffect, useContext } from 'react';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { useScreenSystem } from '../../screen/hook.js';
import { CurrentScreen } from '../../screen/current-screen.js';
import { OverlayContext } from '../../screen/OverlayContext.js';
import { KeyboardProvider } from '../../keyboard/provider.js';
import { useKeyboard } from '../../keyboard/hook.js';
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

function BindingOverlay({ boundKey, onBound }: { boundKey: string; onBound?: () => void }) {
  const overlayId = useContext(OverlayContext);
  const { closeOverlay: cl } = useScreenSystem();
  const { boundSequence, boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundSequence([boundKey, boundKey], onBound ?? (() => {}));
    boundKeyboard(['escape'], () => cl(overlayId!));
  }, []);
  return React.createElement('div', null, boundKey);
}
BindingOverlay.displayName = 'BindingOverlay';

beforeEach(() => {
  clearRegistry();
  capturedInputHandler = null;
  registerComponent(Menu, {});
  registerComponent(GameLevel, { level: 1 }, { parent: Menu });
  registerComponent(Notification, { message: '' });
  registerComponent(BindingOverlay, { boundKey: 'q' });
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
    useEffect(() => {
      kbRef.current = kb;
      scRef.current = sc;
    }, [kb, sc]);
    return React.createElement(CurrentScreen);
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

describe('globalSequence — basic', () => {
  it('fires handler when full 2-key sequence is completed', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);
    getKeyboard()!.globalSequence([
      { keys: ['g', 'g'], operate: handler },
    ]);

    pressKey('g');
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('g');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('globalSequence — validation', () => {
  it('throws when keys array has length < 2', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);
    const handler = vi.fn();

    expect(() =>
      getKeyboard()!.globalSequence([
        { keys: ['a'], operate: handler },
      ]),
    ).toThrow(/at least 2 keys/);

    expect(() =>
      getKeyboard()!.globalSequence([
        { keys: [], operate: handler },
      ]),
    ).toThrow(/at least 2 keys/);
  });
});

describe('globalSequence — priority over globalKeys', () => {
  it('global sequence consumes the first key, global key with same key does not fire', () => {
    const seqHandler = vi.fn();
    const globalHandler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalKeys([
      { key: 'g', operate: globalHandler },
    ]);
    getKeyboard()!.globalSequence([
      { keys: ['g', 'g'], operate: seqHandler },
    ]);

    // First 'g' — consumed by global sequence startup
    pressKey('g');
    expect(globalHandler).toHaveBeenCalledTimes(0);
    expect(seqHandler).toHaveBeenCalledTimes(0);

    // Second 'g' — completes global sequence
    pressKey('g');
    expect(globalHandler).toHaveBeenCalledTimes(0);
    expect(seqHandler).toHaveBeenCalledTimes(1);
  });

  it('fires handler for a 3-key global sequence', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['a', 'b', 'c'], operate: handler },
    ]);

    pressKey('a');
    pressKey('b');
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('c');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('globalSequence — timeout', () => {
  it('cancels pending sequence after custom timeout', () => {
    vi.useFakeTimers();
    const seqHandler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['a', 'b'], operate: seqHandler, timeout: 200 },
    ]);

    pressKey('a');
    expect(seqHandler).toHaveBeenCalledTimes(0);

    // Advance past the timeout
    vi.advanceTimersByTime(201);

    // After timeout, pressing 'b' should not complete the old sequence
    pressKey('b');
    expect(seqHandler).toHaveBeenCalledTimes(0);

    vi.useRealTimers();
  });

  it('completes sequence within timeout', () => {
    vi.useFakeTimers();
    const seqHandler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['x', 'y'], operate: seqHandler, timeout: 500 },
    ]);

    pressKey('x');
    vi.advanceTimersByTime(400);
    pressKey('y');
    expect(seqHandler).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('resets timeout on each matching key for 3-key sequences', () => {
    vi.useFakeTimers();
    const seqHandler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['x', 'y', 'z'], operate: seqHandler, timeout: 200 },
    ]);

    pressKey('x');
    vi.advanceTimersByTime(150);
    pressKey('y');
    // timeout resets from 'y'
    vi.advanceTimersByTime(150);
    pressKey('z');
    expect(seqHandler).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe('globalSequence — exclusive mode', () => {
  it('exclusive mode: mismatch key is consumed silently, sequence keeps waiting', () => {
    vi.useFakeTimers();
    const seqHandler = vi.fn();
    const normalHandler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['g', 'g'], operate: seqHandler, exclusive: true, timeout: 300 },
    ]);
    getKeyboard()!.globalKeys([
      { key: 'x', operate: normalHandler },
    ]);

    pressKey('g'); // start sequence
    pressKey('x'); // mismatch → consumed silently (exclusive)
    expect(normalHandler).toHaveBeenCalledTimes(0);
    expect(seqHandler).toHaveBeenCalledTimes(0);

    // Still within timeout — complete the sequence
    vi.advanceTimersByTime(100);
    pressKey('g');
    expect(seqHandler).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe('globalSequence — non-exclusive mode (default)', () => {
  it('mismatch key cancels pending sequence and falls through to globalKeys', () => {
    vi.useFakeTimers();
    const seqHandler = vi.fn();
    const normalHandler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['a', 'b'], operate: seqHandler },
    ]);
    getKeyboard()!.globalKeys([
      { key: 'x', operate: normalHandler },
    ]);

    pressKey('a'); // start sequence
    expect(seqHandler).toHaveBeenCalledTimes(0);

    pressKey('x'); // mismatch → cancel sequence, x goes to globalKeys
    expect(seqHandler).toHaveBeenCalledTimes(0);
    expect(normalHandler).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('after mismatch cancel, pressing first key again starts a new sequence', () => {
    const seqHandler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['g', 'g'], operate: seqHandler },
    ]);

    pressKey('g'); // start
    pressKey('x'); // cancel
    pressKey('g'); // new start
    pressKey('g'); // complete
    expect(seqHandler).toHaveBeenCalledTimes(1);
  });
});

describe('globalSequence — cover mechanism', () => {
  it('cover: true (default) — screen boundSequence can override global sequence', () => {
    const globalSeqHandler = vi.fn();
    const screenSeqHandler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['g', 'g'], operate: globalSeqHandler, cover: true },
    ]);
    // Screen binds a sequence with the same first key — overrides global
    getKeyboard()!.boundSequence(['g', 'g'], screenSeqHandler);

    pressKey('g');
    pressKey('g');
    expect(screenSeqHandler).toHaveBeenCalledTimes(1);
    expect(globalSeqHandler).toHaveBeenCalledTimes(0);
  });

  it('cover: false — screen boundSequence throws when trying to override', () => {
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['q', 'q'], operate: () => {}, cover: false },
    ]);

    expect(() =>
      getKeyboard()!.boundSequence(['q', 'q'], () => {}),
    ).toThrow(/cover: false/);
  });

  it('boundKeyboard does NOT override global sequence (only boundSequence can)', () => {
    const globalSeqHandler = vi.fn();
    const kbHandler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['g', 'g'], operate: globalSeqHandler },
    ]);
    // boundKeyboard on the first key — does NOT override global sequence
    getKeyboard()!.boundKeyboard(['g'], kbHandler);

    pressKey('g'); // consumed by global sequence startup
    expect(kbHandler).toHaveBeenCalledTimes(0);

    pressKey('g'); // completes global sequence
    expect(globalSeqHandler).toHaveBeenCalledTimes(1);
    expect(kbHandler).toHaveBeenCalledTimes(0);
  });
});

describe('globalSequence — category filtering', () => {
  it('fires only when stack top is in the category whitelist', () => {
    const handler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['g', 'g'], operate: handler, category: [GameLevel] },
    ]);

    // Menu is NOT in the category — 'g' should fall through to nothing
    pressKey('g');
    pressKey('g');
    expect(handler).toHaveBeenCalledTimes(0);

    // Navigate to GameLevel — now in category
    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    pressKey('g');
    pressKey('g');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('category: "*" or omitted works on all screens', () => {
    const handler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['g', 'g'], operate: handler, category: '*' },
    ]);

    pressKey('g');
    pressKey('g');
    expect(handler).toHaveBeenCalledTimes(1);

    // Works on another screen too
    act(() => getScreen()!.skip(GameLevel, { level: 1 }));
    handler.mockClear();
    pressKey('g');
    pressKey('g');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('category: [] disables the global sequence entirely', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['g', 'g'], operate: handler, category: [] },
    ]);

    pressKey('g');
    pressKey('g');
    expect(handler).toHaveBeenCalledTimes(0);
  });
});

describe('globalSequence — affectOverlay', () => {
  it('affectOverlay: true + cover: true → overlay boundSequence overrides global sequence', () => {
    const globalSeqHandler = vi.fn();
    const overlayHandler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['q', 'q'], operate: globalSeqHandler, affectOverlay: true, cover: true },
    ]);

    // Open overlay that also binds 'q' 'q' sequence — overrides global
    act(() => getScreen()!.openOverlay('test-ovl', BindingOverlay, {
      boundKey: 'q',
      onBound: overlayHandler,
    }));

    pressKey('q');
    pressKey('q');
    // Overlay wins because cover: true allows override
    expect(overlayHandler).toHaveBeenCalledTimes(1);
    expect(globalSeqHandler).not.toHaveBeenCalled();
  });

  it('affectOverlay: true + cover: false → overlay boundSequence throws', () => {
    const globalSeqHandler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['q', 'q'], operate: globalSeqHandler, affectOverlay: true, cover: false },
    ]);

    // Opening overlay that tries to bind 'q' 'q' should throw
    expect(() =>
      act(() => getScreen()!.openOverlay('test-ovl', BindingOverlay, {
        boundKey: 'q',
      })),
    ).toThrow(/cover: false/);
  });

  it('affectOverlay: true does NOT fire when no overlay is active (default executeWhenNoOverlay)', () => {
    const globalSeqHandler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['g', 'g'], operate: globalSeqHandler, affectOverlay: true },
    ]);

    pressKey('g');
    pressKey('g');
    expect(globalSeqHandler).toHaveBeenCalledTimes(0);
  });

  it('affectOverlay: true + executeWhenNoOverlay: true fires even without overlay', () => {
    const globalSeqHandler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      {
        keys: ['g', 'g'],
        operate: globalSeqHandler,
        affectOverlay: true,
        executeWhenNoOverlay: true,
      },
    ]);

    pressKey('g');
    pressKey('g');
    expect(globalSeqHandler).toHaveBeenCalledTimes(1);
  });
});

describe('globalSequence — overlay interaction', () => {
  it('affectOverlay: true fires when overlay is present and has no conflicting sequence', () => {
    const globalSeqHandler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['q', 'q'], operate: globalSeqHandler, affectOverlay: true },
    ]);

    // Open a plain overlay that doesn't bind 'q' 'q'
    act(() => getScreen()!.openOverlay('plain-ovl', Notification, { message: '' }));

    pressKey('q');
    pressKey('q');
    expect(globalSeqHandler).toHaveBeenCalledTimes(1);
  });

  it('affectOverlay: false fires after overlay processing when overlay is active', () => {
    const globalSeqHandler = vi.fn();
    const overlayHandler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['g', 'g'], operate: globalSeqHandler, affectOverlay: false },
    ]);

    // Open overlay that binds a different sequence
    act(() => getScreen()!.openOverlay('test-ovl', BindingOverlay, {
      boundKey: 'x',
      onBound: overlayHandler,
    }));

    // 'g' is not bound in overlay → falls through to global sequence
    pressKey('g');
    pressKey('g');
    expect(globalSeqHandler).toHaveBeenCalledTimes(1);
    expect(overlayHandler).not.toHaveBeenCalled();
  });

  it('affectOverlay: true pending sequence survives overlay close', () => {
    vi.useFakeTimers();
    const globalSeqHandler = vi.fn();
    const { getKeyboard, getScreen } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['a', 'b'], operate: globalSeqHandler, affectOverlay: true, timeout: 500 },
    ]);

    // Open overlay, start sequence
    act(() => getScreen()!.openOverlay('plain-ovl', Notification, { message: '' }));
    pressKey('a');

    // Close overlay
    act(() => getScreen()!.closeOverlay('plain-ovl'));

    // Without executeWhenNoOverlay, the pending should be cancelled
    // because the overlay is gone
    pressKey('b');
    expect(globalSeqHandler).toHaveBeenCalledTimes(0);

    vi.useRealTimers();
  });
});

describe('globalSequence — mode: add vs replace', () => {
  it('mode: replace (default) clears previous global sequences', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['a', 'a'], operate: handler1 },
    ]);
    getKeyboard()!.globalSequence([
      { keys: ['b', 'b'], operate: handler2 },
    ]);

    // First sequence should be gone
    pressKey('a');
    pressKey('a');
    expect(handler1).toHaveBeenCalledTimes(0);

    // Second sequence should work
    pressKey('b');
    pressKey('b');
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('mode: add appends without removing existing sequences', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['a', 'a'], operate: handler1 },
    ]);
    getKeyboard()!.globalSequence([
      { keys: ['b', 'b'], operate: handler2 },
    ], { mode: 'add' });

    pressKey('a');
    pressKey('a');
    expect(handler1).toHaveBeenCalledTimes(1);

    pressKey('b');
    pressKey('b');
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});

describe('globalSequence — special keys', () => {
  it('supports sequence of escape keys', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['escape', 'escape'], operate: handler },
    ]);

    pressKey('', { escape: true });
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('', { escape: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports sequence with ctrl+key', () => {
    const handler = vi.fn();
    const { getKeyboard } = renderKeyboardTree(Menu);

    getKeyboard()!.globalSequence([
      { keys: ['ctrl+w', 'ctrl+q'], operate: handler },
    ]);

    pressKey('w', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(0);

    pressKey('q', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
