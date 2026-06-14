import type { Key } from "ink";
import type { OverlayEntry } from "../screen/types.js";

/**
 * Keyboard callback, matching Ink's `useInput` signature.
 *
 * @param input  The raw character string (empty for special keys).
 * @param key    The key descriptor (booleans for special keys, modifiers).
 */
export type KeyHandler = (input: string, key: Key) => void;

/**
 * Options for {@link KeyboardContextValue.boundKeyboard}.
 */
export interface BoundKeyboardOptions {
  /**
   * When `true`, the binding only activates when the owning overlay is the
   * only active overlay (for overlays), or when no overlays are active
   * and the screen is at the top of the stack (for screens).
   */
  onlyThis?: boolean;

  /**
   * Associate this binding with a named focus target on the current screen.
   *
   * Focus targets receive events only when they are the active target on
   * their screen layer. Multiple focus targets on the same screen are
   * navigated via Tab / Shift+Tab or programmatic `focusSet` / `focusNext`.
   *
   * When omitted, the binding is stored at the screen level and always
   * evaluated after the active focus target (if any).
   */
  focusId?: string;

  /**
   * When `true`, the binding is automatically removed after its first
   * invocation. The unbind happens *before* the handler executes, so
   * even if the handler throws, the binding is consumed.
   *
   * Useful for one-shot key bindings (e.g. "press any key to continue").
   */
  once?: boolean;

  /**
   * Number of times the bound key(s) must be pressed before the handler
   * fires. Defaults to `undefined` (fire immediately on every press).
   *
   * The counter is per-binding (all keys in the `keys` array share the
   * same counter) and never auto-resets. When the counter reaches
   * `times`, the handler fires and the counter resets to 0.
   *
   * When combined with `once: true`, the binding is removed after the
   * handler fires (i.e. after `times` presses).
   *
   * Must be >= 1. Throws if 0 or negative.
   *
   * Examples:
   * - `times: 2` → handler fires on the 2nd, 4th, 6th… press.
   * - `times: 3, once: true` → handler fires on the 3rd press and unbinds.
   */
  times?: number;
}

/**
 * A single key-binding entry stored on a screen layer or focus target.
 */
export interface BoundKeyEntry {
  /** Normalized key names to match. */
  keys: string[];
  /** Handler to invoke on match. */
  handler: KeyHandler;
  /** Whether this binding requires the owner to be stack top. */
  onlyThis: boolean;
  /** The screen component or overlay ID that owns this binding. */
  owner: React.ComponentType<any> | string;
  /** Number of presses needed before the handler fires (from options). */
  times?: number;
  /** Current press count. Managed internally by the keyboard provider. */
  pressCount?: number;
}

/**
 * Keyboard state for a single named focus target on a screen layer.
 *
 * Focus targets allow multiple form controls on the same screen to have
 * independent key bindings. Only the currently active target receives
 * events; inactive targets are skipped.
 */
export interface FocusTarget {
  /** Registered key bindings (evaluation order). */
  bindings: BoundKeyEntry[];
  /** Keys marked as transparent on this target (pass-through). */
  blockedKeys: string[];
  /** Keys stopped on this target (propagation barrier). */
  stoppedKeys: string[];
  /** Maps action IDs to the normalized keys that trigger them (for stopAction). */
  actionKeysMap: Map<string, string[]>;
}

/**
 * Options for {@link KeyboardContextValue.boundSequence}.
 *
 * Extends {@link BoundKeyboardOptions} with sequence-specific settings:
 * a per-sequence timeout and an exclusive flag that controls behavior
 * when a mismatched key is pressed during a pending sequence.
 */
export interface SequenceOptions extends BoundKeyboardOptions {
  /**
   * Maximum time in milliseconds between key presses within a sequence.
   * The timer starts when the first key is pressed and resets on each
   * matching key. If it expires before the full sequence is entered, the
   * pending state is cancelled.
   *
   * @default 500
   */
  timeout?: number;

  /**
   * Controls behaviour when a key is pressed that does NOT match the
   * next key expected by a pending sequence.
   *
   * - `false` (default): the mismatched key **cancels** the pending
   *   sequence and falls through to normal `boundKeyboard` bindings.
   * - `true`: the mismatched key is **silently consumed** — the sequence
   *   keeps waiting until the timeout expires or the correct key arrives.
   *   This allows the user to correct a mistaken key without triggering
   *   side effects from normal bindings.
   */
  exclusive?: boolean;
}

/**
 * Internal representation of a sequence that is currently being matched.
 *
 * Created when the first key of a registered `SequenceBinding` is pressed
 * and stored on the layer's {@link ScreenKeyboardLayer.pendingSequence}.
 * Tracked by a `timer` that cancels the pending state if the next key
 * does not arrive within `timeout` milliseconds.
 */
export interface PendingSequence {
  /** The full key sequence to match (copied from `SequenceBinding.keys`). */
  sequences: string[];
  /**
   * Index of the next key to match within `sequences`.
   * Starts at 1 after the first key is consumed.
   */
  nextIndex: number;
  /** Callback to invoke when the full sequence is matched. */
  handler: KeyHandler;
  /** The timeout timer handle; cleared on match, mismatch, or cancellation. */
  timer: NodeJS.Timeout;
  /** Timeout duration in milliseconds. */
  timeout: number;
  /** Options from the original `SequenceBinding`. */
  options?: SequenceOptions;
}

/**
 * A registered multi-key sequence binding.
 *
 * Stored in {@link ScreenKeyboardLayer.sequences}, keyed by the first
 * key in the sequence. When that key is pressed and no other sequence
 * is already pending, the layer enters a pending state waiting for the
 * remaining keys.
 */
export interface SequenceBinding {
  /**
   * Ordered key names making up the full sequence.
   * Must have length ≥ 2 (the first key is the lookup key in the map).
   */
  keys: string[];
  /** Callback to invoke when the full sequence is matched. */
  handler: KeyHandler;
  /**
   * Per-binding timeout override (ms). Falls back to the global
   * `DEFAULT_SEQUENCE_TIMEOUT` (500 ms) when omitted.
   */
  timeout?: number;
  /** Binding options (exclusive mode, focusId, onlyThis, etc.). */
  options?: SequenceOptions;
}

/**
 * Per-layer keyboard state: bindings, transparent keys, stop keys,
 * and focus targets.
 */
export interface ScreenKeyboardLayer {
  /** Registered screen-level key bindings (evaluation order). */
  bindings: BoundKeyEntry[];
  /** Keys marked as transparent at the screen level (pass-through). */
  blockedKeys: string[];
  /** Keys stopped at the screen level (propagation barrier). */
  stoppedKeys: string[];
  /** Keys from globalKeys that this layer has overridden. */
  globalKeyOverrides: Set<string>;

  /** Named focus targets on this layer. */
  focusTargets: Map<string, FocusTarget>;
  /** Registration order of focus target ids. */
  focusOrder: string[];
  /** The currently active focus target id, or null. */
  currentFocusId: string | null;
  /** Maps action IDs to the normalized keys that trigger them (screen-level, excludes focus targets). */
  actionKeysMap: Map<string, string[]>;

  /**
   * Registered sequence bindings, keyed by their first key.
   * When that key is pressed, the matching `SequenceBinding` is used
   * to create a {@link PendingSequence} on this layer.
   */
  sequences: Map<string, SequenceBinding[]>;
  /** Currently active pending sequence, or `null` if none. */
  pendingSequence: PendingSequence | null;
}

/**
 * Options for {@link KeyboardContextValue.stop} when stopping keys
 * within a specific focus target.
 */
export interface StopOptions {
  /** If provided, stops only within the named focus target. */
  focusId?: string;
  /**
   * When `true`, treats each entry in `keys` as a shortcut **action ID**
   * and resolves it to the actual key names currently bound to that action
   * (via the layer's or focus target's `actionKeysMap`).
   *
   * This keeps stopping logic decoupled from literal key names: if you
   * later rebind the action to different keys, the stop still works.
   *
   * @throws If an action ID has no bound keys (never registered or already
   *         unbound).
   */
  stopAction?: boolean;
}

/**
 * Options for {@link KeyboardContextValue.blockedKey} when marking keys
 * as transparent within a specific focus target.
 */
export interface BlockedKeyOptions {
  /** If provided, blocks only within the named focus target. */
  focusId?: string;
}

/**
 * A single global key definition.
 *
 * Global keys fire regardless of the screen stack (subject to
 * `category` whitelist and `affectOverlay` placement).
 */
export interface GlobalKeyEntry {
  /**
   * Key name(s) to match.
   *
   * Supports single string or array. Uses the same normalized key-name
   * format as `boundKeyboard` (`"s"`, `"ctrl+q"`, `"return"`, etc.).
   */
  key: string | string[];

  /** Callback to invoke when the key is pressed.
   * It can also be a string, which is used to directly invoke an operation
   */
  operate: (() => void) | string;

  /**
   * Whether screen components are allowed to override this global key
   * via `boundKeyboard`. Defaults to `true`.
   *
   * When `false`, calling `boundKeyboard` with the same key while the
   * current screen is in the global key's `category` whitelist will
   * throw a runtime error.
   */
  cover?: boolean;

  /**
   * Whether this global key fires before the overlay layer.
   *
   * - `false` (default): Overlay → global key → screen stack
   * - `true`:            Global key → overlay → screen stack
   */
  affectOverlay?: boolean;

  /**
   * Number of times the global key must be pressed before the handler fires.
   * Defaults to `undefined` (fire immediately on every press).
   *
   * The counter is per-global-key-entry and never auto-resets. When the
   * counter reaches `times`, the handler fires and the counter resets to 0.
   *
   * Must be >= 1.
   *
   * Examples:
   * - `times: 2` → handler fires on the 2nd, 4th, 6th… press.
   */
  times?: number;

  /**
   * Whitelist of screen components that may use this global key.
   *
   * - `"*"` or omitted: all screens
   * - `[]`: no screens (effectively disabled)
   * - `[Menu, Game]`: only when the stack top is exactly Menu or Game
   */
  category?: React.ComponentType<any>[] | "*";

  /**
   * This key also works when you have affectOverlay turned on, but you want to have no floating layer
   * You turn it on.
   */
  executeWhenNoOverlay?: boolean;
}

/**
 * A single global sequence key definition.
 *
 * Global sequence keys fire regardless of the screen stack, with higher
 * priority than {@link GlobalKeyEntry}. They match multi-key sequences
 * (e.g. `['g', 'g']`, `['ctrl+w', 'q']`) instead of single key presses.
 *
 * Unlike global keys, global sequences do NOT support `times`.
 *
 * @see {@link KeyboardContextValue.globalSequence}
 */
export interface GlobalSequenceEntry {
  /**
   * Ordered key names that make up the sequence (e.g. `['g', 'g']`,
   * `['ctrl+w', 'q']`). Must have length ≥ 2.
   */
  keys: string[];

  /**
   * Callback to invoke when the full sequence is matched.
   *
   * Can also be a string referencing a registered {@link SequenceOperationEntry}
   * by its `sequenceActionId`. When a string is provided, the action's
   * `action` callback is used. The action must be registered via
   * {@link KeyboardContextValue.defineSequenceAction} or
   * {@link KeyboardContextValue.addSequenceAction} before calling
   * `globalSequence`.
   */
  operate: (() => void) | string;

  /**
   * Whether screen components are allowed to override this global sequence
   * via `boundSequence`. Only sequence bindings can override — ordinary
   * `boundKeyboard` bindings are never checked against global sequences.
   *
   * @default true
   */
  cover?: boolean;

  /**
   * Whether this global sequence fires before the overlay layer.
   *
   * - `false` (default): overlay → global sequence → … → screen stack
   * - `true`:            global sequence → overlay → … → screen stack
   */
  affectOverlay?: boolean;

  /**
   * Whitelist of screen components that may use this global sequence.
   *
   * - `"*"` or omitted: all screens
   * - `[]`: no screens (effectively disabled)
   * - `[Menu, Game]`: only when the stack top is exactly Menu or Game
   */
  category?: React.ComponentType<any>[] | "*";

  /**
   * Maximum time in milliseconds between key presses within the sequence.
   * The timer starts when the first key is pressed and resets on each
   * matching key. If it expires before the full sequence is entered, the
   * pending state is cancelled.
   *
   * @default 500
   */
  timeout?: number;

  /**
   * Controls behaviour when a key is pressed that does NOT match the
   * next key expected by the pending sequence.
   *
   * - `false` (default): the mismatched key **cancels** the pending
   *   sequence and falls through to lower-priority handlers.
   * - `true`: the mismatched key is **silently consumed** — the sequence
   *   keeps waiting until the timeout expires or the correct key arrives.
   */
  exclusive?: boolean;

  /**
   * When `affectOverlay` is `true` but no overlays are active, setting
   * this to `true` makes the global sequence still fire (acting on the
   * screen stack instead). When `false` (default), `affectOverlay: true`
   * global sequences only fire when at least one overlay is active.
   */
  executeWhenNoOverlay?: boolean;
}

/**
 * Type definition for shortcut
 */
export interface ShortcutOperationEntry {
  /**
   * Unique identification of the shortcut
   * Used to get an operation and so on.
   */
  actionId: string;
  /**
   * What does calling a shortcut trigger
   */
  action: () => void;
  /**
   * You can directly specify the predetermined Keys of this Action
   */
  keys?: string[];
}

export interface SequenceOperationEntry {
  /**
   * Unique identification of this Action
   */
  sequenceActionId: string;
  action: () => void;
  /**
   * Preset Key
   */
  keys?: string[];
  /**
   * Preset delay
   */
  timeout?: number;
}

/**
 * Internal type: {@link GlobalSequenceEntry} after string `operate`
 * references have been resolved to callable functions.
 *
 * Used by the keyboard provider's refs after `globalSequence()` resolves
 * action IDs. Public API continues to accept `GlobalSequenceEntry` with
 * `operate: string | (() => void)`.
 */
export interface ResolvedGlobalSequenceEntry extends Omit<GlobalSequenceEntry, 'operate'> {
  operate: () => void;
}

/**
 * Internal type: {@link GlobalKeyEntry} after string `operate`
 * references have been resolved to callable functions and `pressCount`
 * has been initialized for entries with a `times` option.
 *
 * Used by the keyboard provider's refs after `globalKeys()` resolves
 * action IDs. Public API continues to accept `GlobalKeyEntry` with
 * `operate: string | (() => void)`.
 */
export interface ResolvedGlobalKeyEntry {
  key: string | string[];
  operate: () => void;
  cover?: boolean;
  affectOverlay?: boolean;
  category?: React.ComponentType<any>[] | '*';
  times?: number;
  pressCount?: number;
  executeWhenNoOverlay?: boolean;
}

/**
 * Internal state for a global multi-key sequence that is currently being
 * matched across consecutive key presses.
 *
 * Created by the global sequence processor when the first key of a
 * registered {@link GlobalSequenceEntry} matches, and consumed when the
 * full sequence completes or times out.
 */
export interface GlobalPendingSequence {
  sequences: string[];
  nextIndex: number;
  handler: () => void;
  timer: ReturnType<typeof setTimeout>;
  timeout: number;
  exclusive: boolean;
  affectOverlay: boolean;
  cover: boolean;
  category?: React.ComponentType<any>[] | '*';
  executeWhenNoOverlay?: boolean;
}

/**
 * Snapshot of all mutable state needed to process a single key event
 * through the keyboard pipeline.
 *
 * Created once per event by {@link buildPipelineContext}. Immutable
 * snapshot fields reflect the state at the moment the event arrived;
 * mutable coordination fields allow cross-processor communication
 * within a single pipeline run.
 *
 * @2026-06-14 v3.4.0
 */
export interface PipelineContext {
  // --- Immutable per-event snapshots ---
  readonly input: string;
  readonly key: Key;
  readonly eventNames: string[];
  readonly topComponent: React.ComponentType<any> | null;
  readonly globalKeys: ResolvedGlobalKeyEntry[];
  readonly globalSequences: ResolvedGlobalSequenceEntry[];
  readonly activeOverlays: OverlayEntry[];
  readonly activeCount: number;
  readonly wildcardFirst: boolean;
  readonly screenPath: React.ComponentType<any>[];

  // --- Mutable refs (shared with provider) ---
  readonly layersRef: React.MutableRefObject<Map<React.ComponentType<any> | string, ScreenKeyboardLayer>>;
  readonly pendingSeqRef: React.MutableRefObject<GlobalPendingSequence | null>;

  // --- Callbacks ---
  readonly notifyFocusChange: () => void;

  // --- Mutable pipeline coordination state ---
  anyOverlayConsumed: boolean;
}

/**
 * A single stage in the keyboard event pipeline.
 *
 * Each processor evaluates whether it should handle the current event.
 * If it consumes the event it returns `true` and the chain stops;
 * otherwise it returns `false` to pass the event to the next processor.
 */
export interface PipelineProcessor {
  process(ctx: PipelineContext): boolean;
}
