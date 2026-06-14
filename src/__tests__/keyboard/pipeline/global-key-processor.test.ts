import { describe, it, expect, vi } from 'vitest';
import type { Key } from 'ink';
import type {
  PipelineContext,
  ResolvedGlobalKeyEntry,
  ScreenKeyboardLayer,
} from '../../../keyboard/types.js';
import { createGlobalKeyProcessor } from '../../../keyboard/global-key-processor/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noop(): void {}

function makeKey(overrides: Partial<Key> = {}): Key {
  return {
    upArrow: false, downArrow: false, leftArrow: false, rightArrow: false,
    return: false, escape: false, backspace: false, delete: false,
    tab: false, pageDown: false, pageUp: false,
    home: false, end: false, insert: false, numLock: false,
    ctrl: false, shift: false, meta: false,
    ...overrides,
  } as Key;
}

function makeContext(overrides: Partial<PipelineContext> = {}): PipelineContext {
  const layersRef = { current: new Map<any, ScreenKeyboardLayer>() };
  return {
    input: '',
    key: makeKey(),
    eventNames: ['x'],
    topComponent: null,
    globalKeys: [],
    globalSequences: [],
    activeOverlays: [],
    activeCount: 0,
    wildcardFirst: false,
    screenPath: [],
    layersRef,
    pendingSeqRef: { current: null },
    notifyFocusChange: noop,
    anyOverlayConsumed: false,
    ...overrides,
  };
}

function makeEntry(
  overrides: Partial<ResolvedGlobalKeyEntry> = {},
): ResolvedGlobalKeyEntry {
  return {
    key: 'x',
    operate: noop,
    ...overrides,
  };
}

function FakeScreen(): null { return null; }
FakeScreen.displayName = 'FakeScreen';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GlobalKeyProcessor', () => {
  describe('basic matching', () => {
    it('fires handler when key matches', () => {
      const handler = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        globalKeys: [makeEntry({ key: 'x', operate: handler })],
      });

      const result = processor.process(ctx);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('supports array of keys', () => {
      const handler = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['y'],
        topComponent: FakeScreen,
        globalKeys: [makeEntry({ key: ['x', 'y', 'z'], operate: handler })],
      });

      const result = processor.process(ctx);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('returns false when no key matches', () => {
      const handler = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['a'],
        topComponent: FakeScreen,
        globalKeys: [makeEntry({ key: 'x', operate: handler })],
      });

      const result = processor.process(ctx);

      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns false when topComponent is null', () => {
      const handler = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: null,
        globalKeys: [makeEntry({ key: 'x', operate: handler })],
      });

      const result = processor.process(ctx);
      expect(result).toBe(false);
    });

    it('fires the first matching entry only', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        globalKeys: [
          makeEntry({ key: 'x', operate: handler1 }),
          makeEntry({ key: 'x', operate: handler2 }),
        ],
      });

      processor.process(ctx);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  // ---- affectOverlay filtering ----

  describe('affectOverlay filtering', () => {
    it('only processes entries that match the stage affectOverlay', () => {
      const handlerTrue = vi.fn();
      const handlerFalse = vi.fn();

      // Stage ② (affectOverlay: true) processor
      const processor = createGlobalKeyProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        activeCount: 1,
        globalKeys: [
          makeEntry({ key: 'x', operate: handlerTrue, affectOverlay: true }),
          makeEntry({ key: 'x', operate: handlerFalse, affectOverlay: false }),
        ],
      });

      processor.process(ctx);

      expect(handlerTrue).toHaveBeenCalledTimes(1);
      expect(handlerFalse).not.toHaveBeenCalled();
    });

    it('affectOverlay: false processor only fires affectOverlay: false entries', () => {
      const handlerTrue = vi.fn();
      const handlerFalse = vi.fn();

      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        globalKeys: [
          makeEntry({ key: 'x', operate: handlerTrue, affectOverlay: true }),
          makeEntry({ key: 'x', operate: handlerFalse, affectOverlay: false }),
        ],
      });

      processor.process(ctx);

      expect(handlerFalse).toHaveBeenCalledTimes(1);
      expect(handlerTrue).not.toHaveBeenCalled();
    });

    it('affectOverlay: true skips when no overlays and executeWhenNoOverlay is false', () => {
      const handler = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        activeCount: 0,
        globalKeys: [
          makeEntry({ key: 'x', operate: handler, affectOverlay: true, executeWhenNoOverlay: false }),
        ],
      });

      processor.process(ctx);

      expect(handler).not.toHaveBeenCalled();
    });

    it('affectOverlay: true + executeWhenNoOverlay: true fires without overlays', () => {
      const handler = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        activeCount: 0,
        globalKeys: [
          makeEntry({ key: 'x', operate: handler, affectOverlay: true, executeWhenNoOverlay: true }),
        ],
      });

      processor.process(ctx);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ---- Cover / override ----

  describe('cover / override', () => {
    it('affectOverlay: true — skips when overlay has overridden the key', () => {
      const handler = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        activeCount: 1,
        activeOverlays: [{ id: 'ovl1', zIndex: 0, component: FakeScreen, props: {}, createdAt: 0 }],
        globalKeys: [
          makeEntry({ key: 'x', operate: handler, affectOverlay: true, cover: true }),
        ],
      });

      // Overlay overrides the key
      const overlayLayer: ScreenKeyboardLayer = {
        bindings: [], blockedKeys: [], stoppedKeys: [],
        globalKeyOverrides: new Set(['x']),
        focusTargets: new Map(), focusOrder: [], currentFocusId: null,
        actionKeysMap: new Map(), sequences: new Map(), pendingSequence: null,
      };
      ctx.layersRef.current.set('ovl1', overlayLayer);

      processor.process(ctx);

      expect(handler).not.toHaveBeenCalled();
    });

    it('affectOverlay: false — skips when screen layer has overridden the key', () => {
      const handler = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        globalKeys: [
          makeEntry({ key: 'x', operate: handler, affectOverlay: false, cover: true }),
        ],
      });

      const screenLayer: ScreenKeyboardLayer = {
        bindings: [], blockedKeys: [], stoppedKeys: [],
        globalKeyOverrides: new Set(['x']),
        focusTargets: new Map(), focusOrder: [], currentFocusId: null,
        actionKeysMap: new Map(), sequences: new Map(), pendingSequence: null,
      };
      ctx.layersRef.current.set(FakeScreen, screenLayer);

      processor.process(ctx);

      expect(handler).not.toHaveBeenCalled();
    });

    it('cover: false — override check skipped entirely', () => {
      const handler = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        globalKeys: [
          makeEntry({ key: 'x', operate: handler, affectOverlay: false, cover: false }),
        ],
      });

      // Even with override on the layer, cover: false ignores it
      const screenLayer: ScreenKeyboardLayer = {
        bindings: [], blockedKeys: [], stoppedKeys: [],
        globalKeyOverrides: new Set(['x']),
        focusTargets: new Map(), focusOrder: [], currentFocusId: null,
        actionKeysMap: new Map(), sequences: new Map(), pendingSequence: null,
      };
      ctx.layersRef.current.set(FakeScreen, screenLayer);

      processor.process(ctx);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ---- Category ----

  describe('category filtering', () => {
    it('fires only when topComponent is in the category whitelist', () => {
      function OtherScreen(): null { return null; }
      OtherScreen.displayName = 'OtherScreen';

      const handler = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        globalKeys: [
          makeEntry({ key: 'x', operate: handler, category: [OtherScreen] }),
        ],
      });

      processor.process(ctx);
      expect(handler).not.toHaveBeenCalled();
    });

    it('category: [] disables the entry', () => {
      const handler = vi.fn();
      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        globalKeys: [
          makeEntry({ key: 'x', operate: handler, category: [] }),
        ],
      });

      processor.process(ctx);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ---- Times ----

  describe('times', () => {
    it('fires only after N presses', () => {
      const handler = vi.fn();
      const entry = makeEntry({ key: 'x', operate: handler, times: 3 });
      entry.pressCount = 0;

      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        globalKeys: [entry],
      });

      // Press 1
      let result = processor.process(ctx);
      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();

      // Press 2
      result = processor.process(ctx);
      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();

      // Press 3 — fires
      result = processor.process(ctx);
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(entry.pressCount).toBe(0); // reset after fire
    });

    it('times: 1 fires on first press', () => {
      const handler = vi.fn();
      const entry = makeEntry({ key: 'x', operate: handler, times: 1 });
      entry.pressCount = 0;

      const processor = createGlobalKeyProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        globalKeys: [entry],
      });

      processor.process(ctx);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
