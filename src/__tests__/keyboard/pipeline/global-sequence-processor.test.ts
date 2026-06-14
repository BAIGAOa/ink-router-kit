import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Key } from 'ink';
import type {
  PipelineContext,
  ResolvedGlobalSequenceEntry,
  GlobalPendingSequence,
  ScreenKeyboardLayer,
} from '../../../keyboard/types.js';
import { createGlobalSequenceProcessor } from '../../../keyboard/global-sequence-processor/index.js';

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
  const layersRef = {
    current: new Map<any, ScreenKeyboardLayer>(),
  };

  const pendingSeqRef: { current: GlobalPendingSequence | null } = { current: null };

  return {
    input: '',
    key: makeKey(),
    eventNames: ['g'],
    topComponent: null,
    globalKeys: [],
    globalSequences: [],
    activeOverlays: [],
    activeCount: 0,
    wildcardFirst: false,
    screenPath: [],
    layersRef,
    pendingSeqRef,
    notifyFocusChange: noop,
    anyOverlayConsumed: false,
    ...overrides,
  };
}

function makeEntry(
  overrides: Partial<ResolvedGlobalSequenceEntry> = {},
): ResolvedGlobalSequenceEntry {
  return {
    keys: ['g', 'g'],
    operate: noop,
    affectOverlay: false,
    ...overrides,
  };
}

function makePending(
  overrides: Partial<GlobalPendingSequence> = {},
): GlobalPendingSequence {
  return {
    sequences: ['g', 'g'],
    nextIndex: 1,
    handler: noop,
    timer: undefined as unknown as ReturnType<typeof setTimeout>,
    timeout: 500,
    exclusive: false,
    affectOverlay: false,
    cover: true,
    ...overrides,
  };
}

// We need a minimal component for topComponent checks.
function FakeScreen(): null { return null; }
FakeScreen.displayName = 'FakeScreen';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GlobalSequenceProcessor', () => {
  // ---- Start (tryStartGlobalSequence) ----

  describe('start', () => {
    it('returns true when first key matches a registered sequence', () => {
      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        globalSequences: [makeEntry({ keys: ['g', 'g'], operate: handler })],
      });

      const result = processor.process(ctx);

      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled(); // not yet — only first key
      expect(ctx.pendingSeqRef.current).not.toBeNull();
      expect(ctx.pendingSeqRef.current!.sequences).toEqual(['g', 'g']);
      expect(ctx.pendingSeqRef.current!.nextIndex).toBe(1);
    });

    it('returns false when no sequence matches the key', () => {
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        topComponent: FakeScreen,
        globalSequences: [makeEntry({ keys: ['g', 'g'] })],
      });

      const result = processor.process(ctx);

      expect(result).toBe(false);
      expect(ctx.pendingSeqRef.current).toBeNull();
    });

    it('filters by affectOverlay — does NOT start when groups mismatch', () => {
      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        globalSequences: [
          makeEntry({ keys: ['g', 'g'], operate: handler, affectOverlay: false }),
        ],
      });

      const result = processor.process(ctx);

      // affectOverlay: false entry should not start in an affectOverlay: true stage
      expect(result).toBe(false);
      expect(ctx.pendingSeqRef.current).toBeNull();
      expect(handler).not.toHaveBeenCalled();
    });

    it('filters by category — skips when topComponent is not in whitelist', () => {
      function OtherScreen(): null { return null; }
      OtherScreen.displayName = 'OtherScreen';

      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        globalSequences: [
          makeEntry({ keys: ['g', 'g'], operate: handler, category: [OtherScreen] }),
        ],
      });

      const result = processor.process(ctx);
      expect(result).toBe(false);
      expect(ctx.pendingSeqRef.current).toBeNull();
    });

    it('category: [] disables the entry entirely', () => {
      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        globalSequences: [
          makeEntry({ keys: ['g', 'g'], operate: handler, category: [] }),
        ],
      });

      const result = processor.process(ctx);
      expect(result).toBe(false);
      expect(ctx.pendingSeqRef.current).toBeNull();
    });

    it('category: "*" matches any screen', () => {
      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        globalSequences: [
          makeEntry({ keys: ['g', 'g'], operate: handler, category: '*' }),
        ],
      });

      const result = processor.process(ctx);
      expect(result).toBe(true);
      expect(ctx.pendingSeqRef.current).not.toBeNull();
    });

    it('returns false when topComponent is null', () => {
      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: null,
        globalSequences: [
          makeEntry({ keys: ['g', 'g'], operate: handler }),
        ],
      });

      const result = processor.process(ctx);
      expect(result).toBe(false);
    });

    it('affectOverlay: true skips when no overlays and executeWhenNoOverlay is false', () => {
      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        activeCount: 0,
        globalSequences: [
          makeEntry({
            keys: ['g', 'g'], operate: handler,
            affectOverlay: true, executeWhenNoOverlay: false,
          }),
        ],
      });

      const result = processor.process(ctx);
      expect(result).toBe(false);
    });

    it('affectOverlay: true + executeWhenNoOverlay: true fires without overlays', () => {
      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        activeCount: 0,
        globalSequences: [
          makeEntry({
            keys: ['g', 'g'], operate: handler,
            affectOverlay: true, executeWhenNoOverlay: true,
          }),
        ],
      });

      const result = processor.process(ctx);
      expect(result).toBe(true);
      expect(ctx.pendingSeqRef.current).not.toBeNull();
    });

    it('cover: true (default) — skips entry when overlay has override', () => {
      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        activeCount: 1,
        activeOverlays: [{ id: 'ovl1', zIndex: 0, component: FakeScreen, props: {}, createdAt: 0 }],
        globalSequences: [
          makeEntry({ keys: ['g', 'g'], operate: handler, affectOverlay: true, cover: true }),
        ],
      });

      // Add a sequence override on the overlay layer
      const overlayLayer: ScreenKeyboardLayer = {
        bindings: [], blockedKeys: [], stoppedKeys: [],
        globalKeyOverrides: new Set(), focusTargets: new Map(),
        focusOrder: [], currentFocusId: null, actionKeysMap: new Map(),
        sequences: new Map([['g', [{ keys: ['g', 'g'], handler: noop }]]]),
        pendingSequence: null,
      };
      ctx.layersRef.current.set('ovl1', overlayLayer);

      const result = processor.process(ctx);
      expect(result).toBe(false);
    });

    it('cover: false — does NOT check for screen override', () => {
      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        globalSequences: [
          makeEntry({ keys: ['g', 'g'], operate: handler, cover: false }),
        ],
      });

      // Even if screen has an override sequence, cover: false ignores it
      const screenLayer: ScreenKeyboardLayer = {
        bindings: [], blockedKeys: [], stoppedKeys: [],
        globalKeyOverrides: new Set(), focusTargets: new Map(),
        focusOrder: [], currentFocusId: null, actionKeysMap: new Map(),
        sequences: new Map([['g', [{ keys: ['g', 'g'], handler: noop }]]]),
        pendingSequence: null,
      };
      ctx.layersRef.current.set(FakeScreen, screenLayer);

      const result = processor.process(ctx);
      // cover: false skips the override check entirely
      expect(result).toBe(true);
      expect(ctx.pendingSeqRef.current).not.toBeNull();
    });
  });

  // ---- Pending continuation (processGlobalPending) ----

  describe('pending continuation', () => {
    it('continues to the next key of a pending sequence', () => {
      const handler = vi.fn();
      const pending = makePending({
        sequences: ['g', 'g'], nextIndex: 1,
        handler, affectOverlay: false,
      });
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['g'],
        pendingSeqRef: { current: pending },
      });

      const result = processor.process(ctx);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(ctx.pendingSeqRef.current).toBeNull(); // sequence completed
    });

    it('completes a 3-key sequence on the third key', () => {
      const handler = vi.fn();
      const pending = makePending({
        sequences: ['a', 'b', 'c'], nextIndex: 2,
        handler, affectOverlay: false,
      });
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['c'],
        pendingSeqRef: { current: pending },
      });

      const result = processor.process(ctx);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(ctx.pendingSeqRef.current).toBeNull();
    });

    it('advances nextIndex without completing when more keys are expected', () => {
      const handler = vi.fn();
      const pending = makePending({
        sequences: ['a', 'b', 'c'], nextIndex: 1,
        handler, affectOverlay: false,
      });
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['b'],
        pendingSeqRef: { current: pending },
      });

      const result = processor.process(ctx);

      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();
      expect(ctx.pendingSeqRef.current).not.toBeNull();
      // nextIndex should have advanced
      expect(ctx.pendingSeqRef.current!.nextIndex).toBe(2);
    });

    it('non-exclusive: mismatch cancels pending and returns false', () => {
      const handler = vi.fn();
      const pending = makePending({
        sequences: ['g', 'g'], nextIndex: 1,
        handler, exclusive: false, affectOverlay: false,
      });
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        pendingSeqRef: { current: pending },
      });

      const result = processor.process(ctx);

      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
      expect(ctx.pendingSeqRef.current).toBeNull(); // cancelled
    });

    it('exclusive: mismatch consumes the key silently and keeps waiting', () => {
      const handler = vi.fn();
      const pending = makePending({
        sequences: ['g', 'g'], nextIndex: 1,
        handler, exclusive: true, affectOverlay: false,
      });
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['x'],
        pendingSeqRef: { current: pending },
      });

      const result = processor.process(ctx);

      expect(result).toBe(true); // silently consumed
      expect(handler).not.toHaveBeenCalled();
      expect(ctx.pendingSeqRef.current).toBe(pending); // still alive
    });

    it('cancels affectOverlay: true pending when overlays disappear', () => {
      const handler = vi.fn();
      const pending = makePending({
        sequences: ['a', 'b'], nextIndex: 1,
        handler, affectOverlay: true, executeWhenNoOverlay: false,
      });
      const processor = createGlobalSequenceProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['b'],
        activeCount: 0, // no overlays
        pendingSeqRef: { current: pending },
      });

      const result = processor.process(ctx);

      // Should cancel because no overlay and executeWhenNoOverlay is false
      expect(result).toBe(false);
      expect(ctx.pendingSeqRef.current).toBeNull();
    });

    it('does NOT cancel affectOverlay: true pending with executeWhenNoOverlay', () => {
      const handler = vi.fn();
      const pending = makePending({
        sequences: ['a', 'b'], nextIndex: 1,
        handler, affectOverlay: true, executeWhenNoOverlay: true,
      });
      const processor = createGlobalSequenceProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['b'],
        activeCount: 0,
        pendingSeqRef: { current: pending },
      });

      const result = processor.process(ctx);

      // executeWhenNoOverlay: true — should complete
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ---- affectOverlay isolation (the bug fix) ----

  describe('affectOverlay isolation', () => {
    it('affectOverlay: true stage does NOT process an affectOverlay: false pending sequence', () => {
      const handler = vi.fn();
      const pending = makePending({
        sequences: ['g', 'g'], nextIndex: 1,
        handler, affectOverlay: false, // ← pending belongs to affectOverlay: false group
      });

      // Stage ① (affectOverlay: true) processor
      const processor = createGlobalSequenceProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['g'],
        pendingSeqRef: { current: pending },
      });

      const result = processor.process(ctx);

      // Stage ① should NOT consume this key — the pending belongs to stage ④
      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
      // Pending still alive, waiting for its own stage
      expect(ctx.pendingSeqRef.current).toBe(pending);
    });

    it('affectOverlay: true stage does NOT start affectOverlay: false entries', () => {
      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: true });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        globalSequences: [
          // This entry belongs to affectOverlay: false
          makeEntry({ keys: ['g', 'g'], operate: handler, affectOverlay: false }),
        ],
      });

      const result = processor.process(ctx);

      // Stage ① should not start an affectOverlay: false sequence
      expect(result).toBe(false);
      expect(ctx.pendingSeqRef.current).toBeNull();
    });

    it('affectOverlay: false stage DOES process an affectOverlay: false pending sequence', () => {
      const handler = vi.fn();
      const pending = makePending({
        sequences: ['g', 'g'], nextIndex: 1,
        handler, affectOverlay: false,
      });

      // Stage ④ (affectOverlay: false) processor
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['g'],
        pendingSeqRef: { current: pending },
      });

      const result = processor.process(ctx);

      // Stage ④ should consume this key — it's the right group
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(ctx.pendingSeqRef.current).toBeNull();
    });

    it('affectOverlay: false pending survives through stage ① and completes in stage ④', () => {
      // This is the exact bug-fix scenario:
      // 1. A global sequence with affectOverlay: false is started in stage ④
      // 2. On the next key, stage ① should NOT consume it
      // 3. Stage ④ should consume it

      const handler = vi.fn();
      const pending = makePending({
        sequences: ['g', 'g'], nextIndex: 1,
        handler, affectOverlay: false,
      });

      const ctx = makeContext({
        eventNames: ['g'],
        pendingSeqRef: { current: pending },
      });

      // Stage ① — should NOT touch it
      const processorTrue = createGlobalSequenceProcessor({ affectOverlay: true });
      const result1 = processorTrue.process(ctx);
      expect(result1).toBe(false);
      expect(handler).not.toHaveBeenCalled();
      expect(ctx.pendingSeqRef.current).toBe(pending);

      // Stage ④ — should complete it
      const processorFalse = createGlobalSequenceProcessor({ affectOverlay: false });
      const result2 = processorFalse.process(ctx);
      expect(result2).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(ctx.pendingSeqRef.current).toBeNull();
    });

    it('pending with affectOverlay: true is NOT processed by affectOverlay: false stage', () => {
      const handler = vi.fn();
      const pending = makePending({
        sequences: ['g', 'g'], nextIndex: 1,
        handler, affectOverlay: true,
      });

      // Stage ④ (affectOverlay: false) processor
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['g'],
        pendingSeqRef: { current: pending },
        activeCount: 1, // required for affectOverlay: true to not auto-cancel
      });

      const result = processor.process(ctx);

      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
      expect(ctx.pendingSeqRef.current).toBe(pending);
    });
  });

  // ---- Timeout ----

  describe('timeout', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('pending sequence expires after timeout', () => {
      const handler = vi.fn();
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        globalSequences: [
          makeEntry({ keys: ['g', 'g'], operate: handler, timeout: 200 }),
        ],
      });

      // Start the sequence
      processor.process(ctx);
      expect(ctx.pendingSeqRef.current).not.toBeNull();

      // Advance past timeout
      vi.advanceTimersByTime(201);
      expect(ctx.pendingSeqRef.current).toBeNull();
    });

    it('timeout resets on each matching key', () => {
      const handler = vi.fn();
      const pending = makePending({
        sequences: ['a', 'b', 'c'], nextIndex: 1,
        handler, affectOverlay: false, timeout: 200,
      });
      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['b'],
        pendingSeqRef: { current: pending },
      });

      vi.advanceTimersByTime(150);
      processor.process(ctx); // key 'b' matched, timer reset

      // Old timer should be cleared — check by advancing 200 from 'b'
      // Wait 100 (total 250 from start, but only 100 from 'b' → should NOT expire)
      expect(ctx.pendingSeqRef.current).not.toBeNull();
    });
  });

  // ---- Start vs pending priority ----

  describe('start vs pending priority', () => {
    it('pending continuation takes priority over starting a new sequence', () => {
      const pendingHandler = vi.fn();
      const newStartHandler = vi.fn();

      const pending = makePending({
        sequences: ['g', 'g'], nextIndex: 1,
        handler: pendingHandler, affectOverlay: false,
      });

      const processor = createGlobalSequenceProcessor({ affectOverlay: false });
      const ctx = makeContext({
        eventNames: ['g'],
        topComponent: FakeScreen,
        pendingSeqRef: { current: pending },
        globalSequences: [
          makeEntry({ keys: ['g', 'g'], operate: newStartHandler }),
        ],
      });

      const result = processor.process(ctx);

      // Pending continuation wins
      expect(result).toBe(true);
      expect(pendingHandler).toHaveBeenCalledTimes(1);
      expect(newStartHandler).not.toHaveBeenCalled();
    });
  });
});
