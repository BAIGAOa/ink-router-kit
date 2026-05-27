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
  |      +- Focus target (if active) -> blockedKey -> bindings -> stop
  |      +- Screen layer bindings -> blockedKey -> bindings -> stop
  |
  +- 3. Global keys (affectOverlay: false, default)
  |
  +- 4. Screen stack (top to bottom)
  |      For each layer:
  |        +- Tab / Shift+Tab (top layer only) -> switch focus
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

The actionKeysMap is populated automatically whenever boundKeyboard is called with a string handler, and cleaned up when the binding is removed. stopAction with an unregistered action ID simply produces no keys - no error is thrown.

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
  focusUnregister, subscribeFocus, defineShortcutAction,
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
options   | { onlyThis?: boolean; focusId?: string } | Optional behavior flags

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

When the handler is a string (shortcut action ID), the binding is also tracked in an internal actionKeysMap. This enables stop to resolve action IDs to their bound key names.

---

### blockedKey

```tsx
blockedKey(keys, options?): void;
```

Mark keys as transparent on the current layer. When a transparent key reaches this layer, bindings are skipped and the key propagates downward.

Parameter | Type | Description
--------- | ---- | -----------
keys      | string[] | Key names to make transparent
options   | { focusId?: string } | If provided, blocks only within that focus target

Does not return an unbind function.

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

When stopAction is used with an action ID that has no bindings (never registered or already unbound), no keys are added to the stop list and no error is thrown.

---

### globalKeys

```tsx
globalKeys(entries: GlobalKeyEntry[]): void;
```

Register global key bindings that fire independently of the screen stack. Calling this replaces any previously registered global keys.

#### GlobalKeyEntry

Property        | Type | Default | Description
--------------- | ---- | ------- | -----------
key             | string or string[] | - | Key name(s) to match
operate         | () => void or string | - | Callback or shortcut action ID
cover           | boolean | true | Whether screen components may override this key
affectOverlay   | boolean | false | Fire before (true) or after (false) the overlay
category        | ComponentType[] or '*' or undefined | '*' | Screen whitelist; '*' = all, [] = disabled

```tsx
globalKeys([
  { key: 'q', operate: 'quit' },
  { key: 'h', operate: 'help', affectOverlay: true },
]);
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
