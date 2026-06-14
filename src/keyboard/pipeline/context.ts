import type { Key } from 'ink';
import type React from 'react';
import type { OverlayEntry } from '../../screen/types.js';
import type { LayerOwner } from '../context.js';
import type {
  PipelineContext,
  ScreenKeyboardLayer,
  ResolvedGlobalKeyEntry,
  ResolvedGlobalSequenceEntry,
} from '../types.js';
import { normalizeKeyNames } from '../keyNormalizer.js';

/**
 * Collection of all provider refs needed by {@link buildPipelineContext}
 * to snapshot the current keyboard state for a single event.
 */
export interface PipelineRefs {
  pathRef: React.MutableRefObject<React.ComponentType<any>[]>;
  globalKeysRef: React.MutableRefObject<ResolvedGlobalKeyEntry[]>;
  globalSequencesRef: React.MutableRefObject<ResolvedGlobalSequenceEntry[]>;
  activeOverlayIdsRef: React.MutableRefObject<Set<string>>;
  displayedOverlaysRef: React.MutableRefObject<OverlayEntry[]>;
  layersRef: React.MutableRefObject<Map<LayerOwner, ScreenKeyboardLayer>>;
  globalPendingSeqRef: React.MutableRefObject<
    import('../types.js').GlobalPendingSequence | null
  >;
  wildcardPriorityCountRef: React.MutableRefObject<number>;
  notifyFocusChange: () => void;
}

/**
 * Build a {@link PipelineContext} snapshot from the provider's refs.
 *
 * Called once per key event at the top of the `useInput` callback.
 * All `ref.current` values are read synchronously to produce a
 * consistent snapshot for the current event.
 *
 * @param input - Raw character string from Ink's useInput.
 * @param key   - Full Key descriptor from Ink.
 * @param refs  - All mutable refs owned by the keyboard provider.
 * @returns A frozen-in-time context for the pipeline chain.
 */
export function buildPipelineContext(
  input: string,
  key: Key,
  refs: PipelineRefs,
): PipelineContext {
  const eventNames = normalizeKeyNames(input, key);
  const path = refs.pathRef.current;
  const topComponent = path.length > 0 ? path[path.length - 1] : null;
  const globalKeys = refs.globalKeysRef.current;
  const globalSequences = refs.globalSequencesRef.current;
  const activeIds = refs.activeOverlayIdsRef.current;
  const overlays = refs.displayedOverlaysRef.current;
  const activeOverlays = overlays.filter(n => activeIds.has(n.id));
  const activeCount = activeIds.size;
  const wildcardFirst = refs.wildcardPriorityCountRef.current > 0;

  return {
    input,
    key,
    eventNames,
    topComponent,
    globalKeys,
    globalSequences,
    activeOverlays,
    activeCount,
    wildcardFirst,
    screenPath: path,
    layersRef: refs.layersRef,
    pendingSeqRef: refs.globalPendingSeqRef,
    notifyFocusChange: refs.notifyFocusChange,
    anyOverlayConsumed: false,
  };
}
