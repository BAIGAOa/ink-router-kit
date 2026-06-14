import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Key } from 'ink';
import type {
  PipelineContext,
  ScreenKeyboardLayer,
} from '../../../keyboard/types.js';
import { createOverlayProcessor } from '../../../keyboard/overlay-processor/index.js';

// Mock handleLayer so we can control which layers "consume" the event.
const handleLayerMock = vi.fn();
vi.mock('../../../keyboard/layer-handler.js', () => ({
  handleLayer: (...args: unknown[]) => handleLayerMock(...args),
}));

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

function FakeScreen(): null { return null; }
FakeScreen.displayName = 'FakeScreen';

function emptyLayer(): ScreenKeyboardLayer {
  return {
    bindings: [], blockedKeys: [], stoppedKeys: [],
    globalKeyOverrides: new Set(), focusTargets: new Map(),
    focusOrder: [], currentFocusId: null, actionKeysMap: new Map(),
    sequences: new Map(), pendingSequence: null,
  };
}

function makeContext(overrides: Partial<PipelineContext> = {}): PipelineContext {
  const layersRef = { current: new Map<any, ScreenKeyboardLayer>() };
  return {
    input: 'g',
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
    pendingSeqRef: { current: null },
    notifyFocusChange: noop,
    anyOverlayConsumed: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OverlayProcessor', () => {
  beforeEach(() => {
    handleLayerMock.mockReset();
  });

  describe('broadcast semantics', () => {
    it('broadcasts to all active overlays even when one consumes the event', () => {
      const processor = createOverlayProcessor();

      const layerA = emptyLayer();
      const layerB = emptyLayer();
      const ctx = makeContext({
        activeOverlays: [
          { id: 'a', zIndex: 0, component: FakeScreen, props: {}, createdAt: 0 },
          { id: 'b', zIndex: 1, component: FakeScreen, props: {}, createdAt: 1 },
        ],
        activeCount: 2,
      });
      ctx.layersRef.current.set('a', layerA);
      ctx.layersRef.current.set('b', layerB);

      // First overlay consumes, second does not
      handleLayerMock
        .mockReturnValueOnce(true)   // overlay 'a' consumed
        .mockReturnValueOnce(false); // overlay 'b' did not

      const result = processor.process(ctx);

      // Both overlays received the event
      expect(handleLayerMock).toHaveBeenCalledTimes(2);

      // Verify first call args
      expect(handleLayerMock).toHaveBeenNthCalledWith(
        1, layerA, ['g'], 'g', ctx.key,
        true, ctx.notifyFocusChange, 2,
        true, false,
      );

      // Verify second call args
      expect(handleLayerMock).toHaveBeenNthCalledWith(
        2, layerB, ['g'], 'g', ctx.key,
        true, ctx.notifyFocusChange, 2,
        true, false,
      );

      // Chain always continues after overlay broadcast
      expect(result).toBe(false);
    });

    it('sets anyOverlayConsumed when at least one overlay consumed the event', () => {
      const processor = createOverlayProcessor();
      const ctx = makeContext({
        activeOverlays: [
          { id: 'a', zIndex: 0, component: FakeScreen, props: {}, createdAt: 0 },
        ],
        activeCount: 1,
      });
      ctx.layersRef.current.set('a', emptyLayer());
      handleLayerMock.mockReturnValueOnce(true);

      processor.process(ctx);

      expect(ctx.anyOverlayConsumed).toBe(true);
    });

    it('does NOT set anyOverlayConsumed when no overlay consumed', () => {
      const processor = createOverlayProcessor();
      const ctx = makeContext({
        activeOverlays: [
          { id: 'a', zIndex: 0, component: FakeScreen, props: {}, createdAt: 0 },
        ],
        activeCount: 1,
      });
      ctx.layersRef.current.set('a', emptyLayer());
      handleLayerMock.mockReturnValueOnce(false);

      processor.process(ctx);

      expect(ctx.anyOverlayConsumed).toBe(false);
    });

    it('always returns false so the chain continues', () => {
      const processor = createOverlayProcessor();

      // Even when overlay consumes
      handleLayerMock.mockReturnValueOnce(true);
      const ctx = makeContext({
        activeOverlays: [
          { id: 'a', zIndex: 0, component: FakeScreen, props: {}, createdAt: 0 },
        ],
        activeCount: 1,
      });
      ctx.layersRef.current.set('a', emptyLayer());

      const result = processor.process(ctx);
      expect(result).toBe(false);
    });

    it('returns false when there are no active overlays', () => {
      const processor = createOverlayProcessor();
      const ctx = makeContext({ activeOverlays: [], activeCount: 0 });

      const result = processor.process(ctx);

      expect(result).toBe(false);
      expect(handleLayerMock).not.toHaveBeenCalled();
    });

    it('skips overlays that have no registered layer', () => {
      const processor = createOverlayProcessor();
      const ctx = makeContext({
        activeOverlays: [
          { id: 'no-layer', zIndex: 0, component: FakeScreen, props: {}, createdAt: 0 },
          { id: 'has-layer', zIndex: 1, component: FakeScreen, props: {}, createdAt: 1 },
        ],
        activeCount: 2,
      });
      // Only register the second overlay's layer
      ctx.layersRef.current.set('has-layer', emptyLayer());
      handleLayerMock.mockReturnValueOnce(false);

      processor.process(ctx);

      // Only the overlay with a layer should be offered the event
      expect(handleLayerMock).toHaveBeenCalledTimes(1);
    });

    it('passes isOverlay: true to handleLayer', () => {
      const processor = createOverlayProcessor();
      const ctx = makeContext({
        activeOverlays: [
          { id: 'a', zIndex: 0, component: FakeScreen, props: {}, createdAt: 0 },
        ],
        activeCount: 1,
      });
      ctx.layersRef.current.set('a', emptyLayer());
      handleLayerMock.mockReturnValueOnce(false);

      processor.process(ctx);

      // 7th argument is isOverlay
      expect(handleLayerMock).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.anything(), expect.anything(), expect.anything(),
        true, // isOverlay
        expect.anything(),
      );
    });
  });
});
