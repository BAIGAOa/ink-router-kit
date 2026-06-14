import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Key } from 'ink';
import type {
  PipelineContext,
  ScreenKeyboardLayer,
} from '../../../keyboard/types.js';
import { createScreenStackProcessor } from '../../../keyboard/screen-stack-processor/index.js';

// Mock handleLayer to control consumption behaviour.
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

function OtherScreen(): null { return null; }
OtherScreen.displayName = 'OtherScreen';

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

describe('ScreenStackProcessor', () => {
  beforeEach(() => {
    handleLayerMock.mockReset();
  });

  describe('anyOverlayConsumed guard', () => {
    it('skips entirely when an overlay already consumed the event', () => {
      const processor = createScreenStackProcessor();
      const ctx = makeContext({
        anyOverlayConsumed: true,
        screenPath: [FakeScreen],
      });
      ctx.layersRef.current.set(FakeScreen, emptyLayer());

      const result = processor.process(ctx);

      expect(result).toBe(false);
      expect(handleLayerMock).not.toHaveBeenCalled();
    });

    it('processes the screen stack when no overlay consumed', () => {
      const processor = createScreenStackProcessor();
      const ctx = makeContext({
        anyOverlayConsumed: false,
        screenPath: [FakeScreen],
      });
      ctx.layersRef.current.set(FakeScreen, emptyLayer());
      handleLayerMock.mockReturnValueOnce(false);

      processor.process(ctx);

      expect(handleLayerMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('stack traversal', () => {
    it('iterates from top to bottom (reverse order)', () => {
      const processor = createScreenStackProcessor();
      const layerTop = emptyLayer();
      const layerBottom = emptyLayer();
      const ctx = makeContext({
        screenPath: [OtherScreen, FakeScreen], // bottom=OtherScreen, top=FakeScreen
      });
      ctx.layersRef.current.set(FakeScreen, layerTop);
      ctx.layersRef.current.set(OtherScreen, layerBottom);
      handleLayerMock.mockReturnValue(false);

      processor.process(ctx);

      // First called with top layer, then bottom
      expect(handleLayerMock).toHaveBeenCalledTimes(2);
      expect(handleLayerMock).toHaveBeenNthCalledWith(
        1, layerTop, expect.anything(), expect.anything(), expect.anything(),
        true, // isTop
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
      );
      expect(handleLayerMock).toHaveBeenNthCalledWith(
        2, layerBottom, expect.anything(), expect.anything(), expect.anything(),
        false, // not top
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
      );
    });

    it('stops when a layer consumes the event (break)', () => {
      const processor = createScreenStackProcessor();
      const layerTop = emptyLayer();
      const layerBottom = emptyLayer();
      const ctx = makeContext({
        screenPath: [OtherScreen, FakeScreen],
      });
      ctx.layersRef.current.set(FakeScreen, layerTop);
      ctx.layersRef.current.set(OtherScreen, layerBottom);

      // Top layer consumes the event
      handleLayerMock.mockReturnValueOnce(true);

      processor.process(ctx);

      // Bottom layer should NOT receive the event
      expect(handleLayerMock).toHaveBeenCalledTimes(1);
    });

    it('continues to next layer when current does not consume', () => {
      const processor = createScreenStackProcessor();
      const layerA = emptyLayer();
      const layerB = emptyLayer();
      const ctx = makeContext({
        screenPath: [FakeScreen, OtherScreen], // bottom=FakeScreen, top=OtherScreen
      });
      ctx.layersRef.current.set(OtherScreen, layerA);
      ctx.layersRef.current.set(FakeScreen, layerB);

      // First (top) layer does not consume, second (bottom) does
      handleLayerMock
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      processor.process(ctx);

      expect(handleLayerMock).toHaveBeenCalledTimes(2);
    });

    it('skips components that have no registered layer', () => {
      const processor = createScreenStackProcessor();
      const layerB = emptyLayer();
      const ctx = makeContext({
        // FakeScreen has no layer, OtherScreen does
        screenPath: [FakeScreen, OtherScreen],
      });
      ctx.layersRef.current.set(OtherScreen, layerB);
      handleLayerMock.mockReturnValueOnce(false);

      processor.process(ctx);

      // Only OtherScreen's layer should be offered
      expect(handleLayerMock).toHaveBeenCalledTimes(1);
    });

    it('marks the top of the stack correctly as isTop', () => {
      const processor = createScreenStackProcessor();
      const layer = emptyLayer();
      const ctx = makeContext({
        screenPath: [FakeScreen],
      });
      ctx.layersRef.current.set(FakeScreen, layer);
      handleLayerMock.mockReturnValueOnce(false);

      processor.process(ctx);

      expect(handleLayerMock).toHaveBeenCalledWith(
        layer, expect.anything(), expect.anything(), expect.anything(),
        true, // isTop = true because it IS the top
        expect.anything(), expect.anything(),
        false, // isOverlay = false for screen stack
        expect.anything(),
      );
    });

    it('always returns false (last stage)', () => {
      const processor = createScreenStackProcessor();
      const ctx = makeContext({
        screenPath: [FakeScreen],
      });
      ctx.layersRef.current.set(FakeScreen, emptyLayer());
      handleLayerMock.mockReturnValueOnce(true);

      const result = processor.process(ctx);
      expect(result).toBe(false);
    });
  });

  describe('empty stack', () => {
    it('handles empty screen path gracefully', () => {
      const processor = createScreenStackProcessor();
      const ctx = makeContext({ screenPath: [] });

      const result = processor.process(ctx);

      expect(result).toBe(false);
      expect(handleLayerMock).not.toHaveBeenCalled();
    });
  });
});
