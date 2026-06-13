# Keyboard System

ink-kit provides a **layered keyboard event system** built on top of the screen management tree. Instead of a single global `useInput` with messy `if-else` chains, you get **per-screen-layer** key bindings with transparent keys, propagation barriers, global shortcuts, and **within-screen focus management**.

---

## Quick Start

```tsx
import React, { useEffect } from 'react';
import { Box, Text, render } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  useScreenSystem,
  KeyboardProvider,
  useKeyboard,
} from '@baigao_h/ink-kit';

function Menu() {
  const { skip } = useScreenSystem();
  const { boundKeyboard, defineShortcutAction } = useKeyboard();

  useEffect(() => {
    defineShortcutAction([
      { actionId: 'start-game', action: () => skip(Game, { level: 1 }) },
      { actionId: 'quit', action: () => process.exit() },
    ]);
    boundKeyboard(['s'], 'start-game');
    boundKeyboard(['q'], 'quit');
  }, []);

  return (
    <Box flexDirection="column">
      <Text>Main Menu</Text>
      <Text>[S] Start Game  [Q] Quit</Text>
    </Box>
  );
}
registerComponent(Menu, {});

function Game({ level }: { level: number }) {
  const { back } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    boundKeyboard(['b'], () => back());
  }, []);

  return (
    <Box>
      <Text>Level {level} - Press B to go back</Text>
    </Box>
  );
}
registerComponent(Game, { level: 1 }, { parent: Menu });

function App() {
  return (
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  );
}

render(
  <ScenarioManagementProvider defaultScreen={Menu}>
    <App />
  </ScenarioManagementProvider>,
);
```

---

## Important: Component Nesting Order

KeyboardProvider must be nested inside ScenarioManagementProvider, because it depends on the screen context to obtain the current screen stack.

```tsx
{/* Wrong */}
<KeyboardProvider>
  <ScenarioManagementProvider defaultScreen={Menu}>...</ScenarioManagementProvider>
</KeyboardProvider>

{/* Correct */}
<ScenarioManagementProvider defaultScreen={Menu}>
  <KeyboardProvider>...</KeyboardProvider>
</ScenarioManagementProvider>
```

---

## Concepts

### Layered Event Handling

Every screen in the tree has its own keyboard layer. When a key is pressed, the event travels through a priority chain:

```
Key pressed
  |
  +- 1. Global keys (affectOverlay: true)
  |
  +- 2. Active overlay layer
  |      +- Tab / Shift+Tab -> switch focus
  |      +- Sequence matching -> pending / advance / cancel
  |      +- Focus target (if active) -> blockedKey -> bindings -> stop
  |      +- Screen layer bindings -> blockedKey -> bindings -> stop
  |
  +- 3. Global keys (affectOverlay: false, default)
  |
  +- 4. Screen stack (top to bottom)
  |      For each layer:
  |        +- Tab / Shift+Tab (top layer only) -> switch focus
  |        +- Sequence matching (top layer only) -> pending / advance / cancel
  |        +- Focus target (top layer only) -> blockedKey -> bindings -> stop
  |        +- Screen layer bindings -> blockedKey -> bindings -> stop
  |
  +- 5. Dropped (unhandled)
```

### Screen-Level vs Focus-Level

Before the focus system, all bindings within a screen shared the same bucket. Two SelectInput components on the same screen would both bind up/down/return and collide. The focus system splits each layer into two tiers:

- **Screen-level bindings**: the original boundKeyboard without focusId. Always active.
- **Focus targets**: named buckets created by passing focusId in BoundKeyboardOptions. Only the currently active target receives events.

Events always check the active focus target first, then fall through to screen-level bindings.

Multiple form controls on the same screen can each own a focus target. The built-in Tab key rotates between them automatically.

### Shortcut Actions

Shortcut actions decouple operation definition from key binding. Instead of passing inline functions to boundKeyboard, you register named operations with defineShortcutAction and reference them by string ID:

```tsx
defineShortcutAction([
  { actionId: 'submit', action: () => console.log('submitted') },
]);

boundKeyboard(['return'], 'submit');
boundKeyboard(['ctrl+s'], 'submit', { focusId: 'editor' });
```

This makes it possible to reconfigure keys (via JSON) without touching code.

### Action-Based Stopping

When you stop a key by its action ID (rather than by literal key name), the system looks up the keys currently bound to that action via an internal actionKeysMap and adds them to the stop list. This keeps your stopping logic decoupled from key names:

```tsx
defineShortcutAction([{ actionId: 'save', action: saveGame }]);
boundKeyboard(['ctrl+s'], 'save', { focusId: 'editor' });

// Stop whatever key happens to be bound to 'save'
stop(['save'], { stopAction: true, focusId: 'editor' });
```

If you later rebind save to meta+s, the stop call still works - it always resolves the action to its current keys.

The actionKeysMap is populated automatically whenever boundKeyboard is called with a string handler, and cleaned up when the binding is removed. stopAction with an unregistered action ID throws an error.

---

## API Reference

### KeyboardProvider

```tsx
<KeyboardProvider>
  {children}
</KeyboardProvider>
```

Root context provider for the keyboard system. Handles useInput from Ink and routes all key events through the layered priority chain.

Must be nested inside ScenarioManagementProvider.

---

### useKeyboard

```tsx
const {
  boundKeyboard, blockedKey, stop, globalKeys,
  focusSet, focusNext, focusPrev, focusCurrent,
  focusUnregister, subscribeFocus,
  defineShortcutAction, addAction, hasAction,
  removeAction, modifyAction, clearShortcutOperations,
  boundSequence, enableWildcardPriority,
} = useKeyboard();
```

React hook returning the keyboard API. Must be used inside KeyboardProvider, otherwise throws an error.

---

### defineShortcutAction

```tsx
defineShortcutAction(entries: ShortcutOperationEntry[]): void;
```

Register named shortcut actions. Can be referenced by boundKeyboard, globalKeys, and stop (with stopAction: true).

Parameter | Type | Description
--------- | ---- | -----------
entries   | ShortcutOperationEntry[] | Array of { actionId: string, action: () => void }

```tsx
defineShortcutAction([
  { actionId: 'start-game', action: () => skip(Game, {}) },
  { actionId: 'quit', action: () => process.exit() },
  { actionId: 'save', action: () => saveGame() },
]);

// Reference by ID anywhere:
boundKeyboard(['s'], 'start-game');
boundKeyboard(['ctrl+s'], 'save', { focusId: 'editor' });
globalKeys([{ key: 'q', operate: 'quit' }]);
stop(['save'], { stopAction: true, focusId: 'editor' });
```

---

### useFocusState

```tsx
const isFocused = useFocusState(focusId: string): boolean;
```

Returns true when the given focusId is the currently active focus target. Reactively re-renders on focus changes.

---

### boundKeyboard

```tsx
boundKeyboard(keys, handler, options?): () => void;
```

Bind one or more keys to a handler on the top-of-stack screen.

Parameter | Type | Description
--------- | ---- | -----------
keys      | string[] | Key names to bind (e.g. ['s'], ['ctrl+q', 'return'])
handler   | (input, key) => void or string | Callback or shortcut action ID
options   | { onlyThis?: boolean; focusId?: string; once?: boolean; times?: number } | Optional behavior flags

Returns an unbind function.

The handler accepts two forms:
1. **Function** - an inline callback
2. **String** - an action ID registered via defineShortcutAction

```tsx
boundKeyboard(['s'], () => skip(Game, {}));
boundKeyboard(['s'], 'start-game');
boundKeyboard(['ctrl+s'], 'save', { focusId: 'editor' });
```

**Key name format:**

Example        | Key Pressed
-------------- | ----------------------------
's'            | s key
'return'       | Enter/Return
'escape'       | Escape
'backspace'    | Backspace
'ctrl+s'       | Ctrl + S
'shift+tab'    | Shift + Tab
'meta+f'       | Meta/Command + F
'up'           | Up arrow
'down'         | Down arrow

**onlyThis**: when true, the binding only activates when the owning screen is top-of-stack and no overlay is open.

**focusId**: when provided, the binding is stored on a named focus target. Only the currently active focus target receives events.

**once**: when `true`, the binding is automatically removed after its first successful invocation. The unbind happens _before_ the handler executes — so even if the handler throws, the binding is consumed and the key will not fire again. Returns the same unbind function for manual early removal.

```tsx
// One-shot "press any key to continue"
useEffect(() => {
  boundKeyboard(['a', 'b', 'c', 'return', 'escape', ' '], () => {
    // first press triggers, then binding auto-removes
  }, { once: true });
}, []);
```

**times**: requires the bound key(s) to be pressed **N times** before the handler fires. The counter is per-binding — all keys in the `keys` array share the same counter — and never auto-resets. When the counter reaches `times`, the handler fires and the counter resets to 0.

Can be combined with `once: true` to unbind after the threshold is reached.

Must be >= 1; passing 0 or negative throws a runtime error.

```tsx
// Press 'q' twice to quit
useEffect(() => {
  boundKeyboard(['q'], () => process.exit(), { times: 2 });
}, []);

// Press escape 3 times to exit a modal, then unbind
useEffect(() => {
  boundKeyboard(['escape'], closeModal, { times: 3, once: true });
}, []);

// Combined with focusId — each focus target has its own counter
useEffect(() => {
  boundKeyboard(['return'], submit, { times: 2, focusId: 'form' });
}, []);
```

When the handler is a string (shortcut action ID), the binding is also tracked in an internal actionKeysMap. This enables stop to resolve action IDs to their bound key names.

---

### blockedKey

```tsx
blockedKey(keys, options?): void;
```

Mark keys as transparent on the current layer. When a transparent key reaches this layer, bindings are skipped and the key propagates downward.

Returns an unbind function that removes the keys from the transparent list when called.

Parameter | Type | Description
--------- | ---- | -----------
keys      | string[] | Key names to make transparent
options   | { focusId?: string } | If provided, blocks only within that focus target

---

### stop

```tsx
stop(keys, options?): () => void;
```

Prevent keys from propagating to lower layers. The layer's own bindings are evaluated first; only if no binding matches does the stop take effect.

Returns an unstop function.

Parameter | Type | Default | Description
--------- | ---- | ------- | -----------
keys      | string[] | - | Key names or action IDs (see stopAction)
options   | { focusId?, stopAction? } | - | Optional targeting and action resolution

**focusId**: stops only within the named focus target.

**stopAction**: when true, treats each entry in keys as a shortcut action ID and resolves it to the actual key names currently bound to that action.

```tsx
// Stop by literal key name
stop(['x']);

// Stop within a focus target
stop(['x'], { focusId: 'child-focus' });

// Stop by action ID
defineShortcutAction([{ actionId: 'save', action: saveGame }]);
boundKeyboard(['ctrl+s'], 'save', { focusId: 'editor' });
stop(['save'], { stopAction: true, focusId: 'editor' });
```

When stopAction is used with an action ID that has no bindings (never registered or already unbound), an error is thrown.

---

### globalKeys

```tsx
globalKeys(entries: GlobalKeyEntry[], options?): void;
```

Register global key bindings that fire independently of the screen stack.

By default (or with `{ mode: 'replace' }`), replaces all previously registered global keys. Pass `{ mode: 'add' }` to append without removing existing entries.

```tsx
globalKeys([
  { key: 'q', operate: 'quit' },
  { key: 'h', operate: 'help', affectOverlay: true },
], { mode: 'add' });
```

#### GlobalKeyEntry

Property            | Type | Default | Description
------------------- | ---- | ------- | -----------
key                 | string or string[] | - | Key name(s) to match
operate             | () => void or string | - | Callback or shortcut action ID
cover               | boolean | true | Whether screen components may override this key
affectOverlay       | boolean | false | Fire before (true) or after (false) the overlay
category            | ComponentType[] or '*' or undefined | '*' | Screen whitelist; '*' = all, [] = disabled
times               | number | undefined | Number of presses needed before handler fires (must be >= 1)
executeWhenNoOverlay | boolean | false | When `affectOverlay: true`, also execute when no overlay is open

---

### globalSequence

```tsx
globalSequence(entries: GlobalSequenceEntry[], options?): void;
```

Register global sequence key bindings with **higher priority** than global keys.
They match multi-key sequences (e.g. `gg`, `ctrl+w q`) across all screens.

By default (or with `{ mode: 'replace' }`), replaces all previously registered
global sequences. Pass `{ mode: 'add' }` to append.

**Priority chain** (highest to lowest):

1. globalSequence (affectOverlay: true)
2. globalKeys (affectOverlay: true)
3. Overlay layer
4. globalSequence (affectOverlay: false)
5. globalKeys (affectOverlay: false)
6. Screen stack

**Cover**: Only `boundSequence` can override a global sequence — `boundKeyboard`
cannot. When `cover: false`, calling `boundSequence` with a matching first key
throws.

**No `times` support**: Unlike global keys, global sequences do not support `times`.

#### GlobalSequenceEntry

Property              | Type     | Default | Description
--------------------- | -------- | ------- | -----------
keys                  | string[] | -       | Ordered key names (≥ 2). E.g. `['g', 'g']`
operate               | () => void | -     | Callback when full sequence is matched
cover                 | boolean  | true    | Whether `boundSequence` may override
affectOverlay         | boolean  | false   | Fire before (true) or after (false) overlays
category              | ComponentType[] or `'*'` or undefined | `'*'` | Screen whitelist
timeout               | number   | 500     | Max time (ms) between key presses
exclusive             | boolean  | false   | If true, mismatched keys consumed silently
executeWhenNoOverlay  | boolean  | false   | When `affectOverlay: true`, fire without overlay

```tsx
// 'gg' shortcut anywhere
globalSequence([
  { keys: ['g', 'g'], operate: () => gotoScreen(Settings) },
]);

// With affectOverlay + exclusive mode
globalSequence([
  {
    keys: ['ctrl+w', 'q'],
    operate: closeTab,
    affectOverlay: true,
    exclusive: true,
    timeout: 1000,
  },
]);
```

---

### boundSequence

```tsx
boundSequence(keys, handler, options?): () => void;
```

Register a multi-key sequence binding (Vim-style key chords like `gg`, `dd`, `cw`).

**Sequence priority**: Sequences are evaluated **before** ordinary `boundKeyboard` bindings. When a sequence's first key is pressed, it is consumed by the sequence system and will not trigger any normal binding for that key.

Parameter | Type | Description
--------- | ---- | -----------
keys      | string[] | Ordered key names (e.g. `['g', 'g']`, `['c', 'w']`). Length must be ≥ 2.
handler   | (input, key) => void | Callback invoked when the full sequence is matched
options   | `{ timeout?, onlyThis?, focusId?, exclusive? }` | Optional behavior flags

Returns an unbind function.

**Options**:

- **timeout** (ms, default 500): Maximum time between key presses. Timer starts on the first key and resets on each match.
- **exclusive** (default false): When `true`, mismatched keys are silently consumed — the sequence keeps waiting. When `false` (default), a mismatched key cancels the pending sequence and falls through to normal bindings.
- **onlyThis** / **focusId**: Same behavior as `boundKeyboard`.

```tsx
// Vim-like 'gg' to scroll to top
useEffect(() => {
  boundSequence(['g', 'g'], () => scrollToTop());
}, []);

// Exclusive mode: only 'ctrl+w' 'q' triggers, no other key interrupts
useEffect(() => {
  boundSequence(['ctrl+w', 'q'], closeTab, { exclusive: true, timeout: 1000 });
}, []);

// Sequence restricted to a specific focus target
useEffect(() => {
  boundSequence(['d', 'd'], deleteLine, { focusId: 'editor' });
}, []);
```

**Layer isolation**: Each screen/overlay maintains its own pending sequence. Navigating away, switching focus, or closing an overlay automatically cancels any pending sequence.

---

### enableWildcardPriority

```tsx
enableWildcardPriority(): () => void;
```

Enable wildcard priority mode. Returns a disable function that restores the original priority when called.

When enabled, wildcard `*` bindings take **absolute priority** over ALL other key handling — sequences, exact key matches, everything. Only normal character input (letters, numbers, symbols) is affected; special keys (Tab, Return, Escape, arrow keys, Ctrl combinations, etc.) are never matched by wildcard and always fall through to normal processing.

**Use case**: TextInput components that need to capture all typing input without other key bindings on the same layer intercepting characters.

```tsx
function TextInput({ value, onChange, focusId }: TextInputProps) {
  const { boundKeyboard, enableWildcardPriority } = useKeyboard();

  useEffect(() => {
    // Enable wildcard priority so our '*' binding captures all normal
    // characters before any other exact key bindings on this layer
    const disable = enableWildcardPriority();
    const unbind = boundKeyboard(['*'], (input) => {
      onChange(value + input);
    }, { focusId });

    return () => {
      unbind();
      disable(); // restore original priority
    };
  }, [focusId]);

  return <Text>{value}</Text>;
}
```

**Reference counting**: Multiple callers can call `enableWildcardPriority()` independently. Each returned disable function decrements an internal counter; the mode is only disabled when the counter reaches zero. This prevents interference between multiple components that each need wildcard priority.

**Important notes**:
- `isNormalCharacter` is still respected: only characters that pass this check trigger the wildcard, even in priority mode.
- The mode is **global** (keyboard-wide): it affects all layers (screens, overlays, and focus targets) equally.

---

### Shortcut Action Management

Beyond `defineShortcutAction`, the following APIs allow dynamic management of shortcut operations:

#### addAction

```tsx
addAction(entry: ShortcutOperationEntry): void;
```

Register a single shortcut action dynamically. Throws if an action with the same `actionId` already exists.

#### hasAction

```tsx
hasAction(actionId: string): boolean;
```

Check whether a shortcut action with the given ID is registered.

#### removeAction

```tsx
removeAction(actionId: string): void;
```

Remove a registered shortcut action. Throws if no action with the given ID exists.

#### modifyAction

```tsx
modifyAction(actionId: string, keys: string[]): void;
```

Change the default keys of an existing shortcut action. Throws if the action does not exist or was not registered with a `keys` field.

#### clearShortcutOperations

```tsx
clearShortcutOperations(): void;
```

Remove all registered shortcut operations. Primarily used for testing or full keyboard reset.

```tsx
// Dynamic shortcut management
const { addAction, hasAction, removeAction, modifyAction } = useKeyboard();

addAction({ actionId: 'reload', action: () => fetchData() });

if (hasAction('reload')) {
  modifyAction('reload', ['ctrl+r']);
  boundKeyboard(['ctrl+r'], 'reload');
}

removeAction('obsolete-action');
```

---

### Focus Management APIs

Available from useKeyboard(), operating on the current screen's focus targets.

- **focusSet(id: string)**: Activate a specific focus target by its id.
- **focusNext()**: Rotate to the next focus target (equivalent to Tab).
- **focusPrev()**: Rotate to the previous focus target (equivalent to Shift+Tab).
- **focusCurrent()**: Returns the active focus id, or null if none.
- **focusUnregister(id: string)**: Remove a focus target. If it was active, the next target is activated automatically.
- **subscribeFocus(listener: () => void)**: Subscribe to focus changes. Returns an unsubscribe function.

---

## Built-in Tab Navigation

When a screen has one or more focus targets, the keyboard system intercepts tab and shift+tab at the top layer and rotates through targets in registration order.

- **Tab**: activate next focus target
- **Shift+Tab**: activate previous focus target

This is automatic. If a screen has no focus targets, Tab keys fall through to screen-level bindings.

---

## Common Patterns

### Per-Screen Key Binding

```tsx
function Game() {
  const { back } = useScreenSystem();
  const { boundKeyboard, stop } = useKeyboard();

  useEffect(() => {
    const unbindB = boundKeyboard(['b'], () => back());
    const unstopQ = stop(['q']);
    return () => { unbindB(); unstopQ(); };
  }, []);

  return <Text>Playing...</Text>;
}
```

### Using Shortcut Actions

```tsx
function Menu() {
  const { skip } = useScreenSystem();
  const { boundKeyboard, defineShortcutAction } = useKeyboard();

  useEffect(() => {
    defineShortcutAction([
      { actionId: 'start-game', action: () => skip(Game, {}) },
      { actionId: 'open-settings', action: () => skip(Settings, {}) },
    ]);
    boundKeyboard(['s'], 'start-game');
    boundKeyboard(['c'], 'open-settings');
  }, []);

  return <Text>Main Menu</Text>;
}
```

### Blocking Keys for Pass-Through

```tsx
function Combat() {
  const { boundKeyboard, blockedKey } = useKeyboard();

  useEffect(() => {
    blockedKey(['e']);
    boundKeyboard(['a'], () => attack());
  }, []);

  return <Text>Combat! Press A to attack.</Text>;
}
```

### Stopping by Action ID

```tsx
defineShortcutAction([
  { actionId: 'save', action: () => saveGame() },
  { actionId: 'quit', action: () => process.exit() },
]);

boundKeyboard(['ctrl+s'], 'save', { focusId: 'editor' });
boundKeyboard(['ctrl+q'], 'quit', { focusId: 'editor' });

// Block propagation of whatever keys are bound to 'quit'
stop(['quit'], { stopAction: true, focusId: 'editor' });
```

If you later rebind quit from ctrl+q to q, the stop still works.

To restore propagation, call the returned unstop function:

```tsx
const unstop = stop(['quit'], { stopAction: true });
unstop(); // Remove 'quit' keys from the stop list
```

Note: stop does not affect bindings on the current layer. It only blocks propagation to lower layers.

### Global Keys with Shortcut Actions

```tsx
function App() {
  const { globalKeys, defineShortcutAction } = useKeyboard();

  useEffect(() => {
    defineShortcutAction([
      { actionId: 'quit', action: () => process.exit() },
      { actionId: 'help', action: () => showHelp() },
    ]);
    globalKeys([
      { key: 'q', operate: 'quit', cover: false },
      { key: 'h', operate: 'help', affectOverlay: true },
    ]);
  }, []);

  return <CurrentScreen />;
}
```

### Vim-Style Key Sequences

```tsx
function Editor() {
  const { boundSequence, boundKeyboard } = useKeyboard();

  useEffect(() => {
    // 'gg' to go to top
    boundSequence(['g', 'g'], () => cursorToTop());

    // 'dd' to delete line
    boundSequence(['d', 'd'], () => deleteCurrentLine());

    // Normal 'g' key is consumed by the sequence system, so bind a
    // different key for ordinary 'g' if needed (or omit entirely).
    boundKeyboard(['G'], () => cursorToBottom());
  }, []);

  return <Text>Editor</Text>;
}
```

### Multiple Controls on One Screen

```tsx
function Settings() {
  return (
    <Box flexDirection="column">
      <Text bold>Settings</Text>
      <SelectInput focusId="theme-picker" items={themes} ... />
      <SelectInput focusId="difficulty-picker" items={difficulties} ... />
      <Text dimColor>Press Tab to switch focus</Text>
    </Box>
  );
}
```

---

## Complete Event Chain

```
Key pressed
  |
  +- 1. Global keys (affectOverlay: true)
  |        matched -> consume, stop
  |
  +- 2. Active overlay layer
  |      +- Tab / Shift+Tab -> switch focus
  |      +- Pending sequence (if any)
  |      |    +- match next key? -> advance; full match? -> fire handler
  |      |    +- mismatch? exclusive? -> consume, keep waiting
  |      |    +- mismatch? non-exclusive? -> cancel, fall through
  |      +- New sequence candidate? -> start pending sequence, consume
  |      +- Focus target (if active)
  |      |    +- blockedKey -> skip bindings
  |      |    +- boundKeyboard matched? -> consume, stop
  |      |    +- stop keys matched? -> consume, block
  |      +- Overlay layer bindings
  |      |    +- blockedKey -> skip bindings
  |      |    +- boundKeyboard matched? -> consume, stop
  |      |    +- stop keys matched? -> consume, block
  |      +- (none matched) -> continue
  |
  +- 3. Global keys (affectOverlay: false, default)
  |        matched -> consume, stop
  |
  +- 4. Screen stack (top to bottom)
  |      for each layer:
  |        +- Tab / Shift+Tab (top layer only) -> switch focus
  |        +- Pending sequence (top layer only, if any)
  |        |    +- match next key? -> advance; full match? -> fire handler
  |        |    +- mismatch? exclusive? -> consume, keep waiting
  |        |    +- mismatch? non-exclusive? -> cancel, fall through
  |        +- New sequence candidate? (top layer only) -> start pending, consume
  |        +- Focus target (top layer only, if active)
  |        |    +- blockedKey -> skip bindings
  |        |    +- boundKeyboard matched? -> consume, stop
  |        |    +- stop keys matched? -> consume, block
  |        +- Screen layer bindings
  |             +- blockedKey -> skip bindings
  |             +- boundKeyboard matched? -> consume, stop
  |             +- (top layer only) stop keys matched? -> consume, block
  |        +- (none matched) -> continue to next layer
  |
  +- 5. Dropped (no handler matched)
```

When stop is used with stopAction: true, the action IDs are resolved to key names via the layer's or focus target's actionKeysMap **before** any matching takes place. The resolution is invisible to the event chain - stop still operates on literal key names internally.
