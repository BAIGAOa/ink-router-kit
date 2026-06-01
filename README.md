# ink-router-kit

> Ready-to-use Ink components and tools for building terminal UI applications.

[![CI](https://github.com/BAIGAOa/ink-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/BAIGAOa/ink-trc/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@baigao_h/ink-kit.svg)](https://www.npmjs.com/package/@baigao_h/ink-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


---

## Getting Started

### Quick Start (scaffold a new project)

```bash
npx @baigao_h/ink-kit init my-tui
cd my-tui
npm start
```

### Install in existing project

```bash
npm install @baigao_h/ink-kit
```

### Requirements

| Dependency | Minimum Version |
| ---------- | --------------- |
| Node.js    | 22              |
| ink        | 5               |
| react      | 18              |

---

## Design Philosophy

ink-kit aims to make **screen management** and **keyboard event handling** in Ink applications composable, maintainable, and type-safe.

### Screen as Component

In ink-kit, **every React component is a "screen"**. Register them into a **screen tree** via `registerComponent`, then navigate the tree with `skip` / `back` / `gotoScreen`. This design makes screen navigation predictable and eliminates the chaos of hand-written conditional rendering (`if-else` / `switch`).

### Layered Keyboard Events

No more global `useInput` cluttered with `if-else` chains. ink-kit's keyboard system maintains **per-screen-layer** key bindings. Events bubble from **top to bottom** through the stack, with three key mechanisms:

- **Blocked Key (`blockedKey`)** — Let a key pass through the current layer to be handled below
- **Stop (`stop`)** — Prevent a key from propagating to lower layers. Supports `stopAction` mode to block by shortcut action ID instead of literal key name
- **Global Key (`globalKeys`)** — Shortcuts independent of the screen stack

#### Finer-grained partitioning

Within the same level, identical keys are also in competition. To address this, we have a complete **focus system**.  
Each level maintains a set of focus targets, and only one focus is active at any given time within a level. Each focus target has its own bound keyboard operations. Only the activated focus target is eligible to execute them during event dispatching in **useInput**.  

**For more details, please refer to the API documentation.**

### Shortcut Actions

Decouple operation definition from key binding with `defineShortcutAction`. Register named operations once, then reference them by string ID in `boundKeyboard`, `globalKeys`, and `stop`:

```tsx
defineShortcutAction([
  { actionId: 'quit', action: () => process.exit() },
]);
boundKeyboard(['q'], 'quit');
globalKeys([{ key: 'escape', operate: 'quit' }]);
stop(['quit'], { stopAction: true });
```

### Overlay System

`overlay()` and `closeOverlay()` provide floating dialogs on top of the screen stack. Combined with the keyboard system, overlays intercept keys before they reach the underlying screen — ideal for confirmation dialogs, modals, and pop-up menus.

### Module-Level Functions

Navigation functions (`skip`, `back`, `gotoScreen`, `overlay`, `closeOverlay`) work both inside React components (via hooks) and as **module-level imports** in any `.ts` / `.tsx` file. This allows non-UI layers — game engines, state managers, etc. — to trigger screen transitions.

### Type Safety

Every API provides full TypeScript type inference. Functions like `skip`, `gotoScreen`, and `overlay` automatically infer parameter types from your component's props, catching errors at compile time.

---

## ⚠️ Important: Component Nesting Order

`KeyboardProvider` **must** be nested inside `ScenarioManagementProvider`, because it depends on the screen context to obtain the current screen stack.

```tsx
{/* ❌ Wrong: KeyboardProvider outside screen context */}
<KeyboardProvider>
  <ScenarioManagementProvider defaultScreen={Menu}>
    ...
  </ScenarioManagementProvider>
</KeyboardProvider>

{/* ✅ Correct: KeyboardProvider inside screen context */}
<ScenarioManagementProvider defaultScreen={Menu}>
  <KeyboardProvider>
    ...
  </KeyboardProvider>
</ScenarioManagementProvider>
```

> The screen system can be used independently without `KeyboardProvider`; but the keyboard system requires the screen context.

---

## Documentation

- **[Screen Management System](src/screen/README.md)** — `registerComponent`, `ScenarioManagementProvider`, `CurrentScreen`, `useScreenSystem`, `skip` / `back` / `gotoScreen` / `overlay` / `closeOverlay`
- **[Keyboard System](src/keyboard/README.md)** — `KeyboardProvider`, `useKeyboard`, `boundKeyboard`, `blockedKey`, `stop`, `globalKeys`, `defineShortcutAction`, focus management
- **[Internationalization](src/language/README.md)** — `LanguageProvider`, `useI18n`, `t()` translation with interpolation, language switching

---

## Components

### Selection & Input
- **[SelectInput](src/components/select/README.md)** — Single-select list with focus-aware keyboard navigation
- **[MultiSelectInput](src/components/multi-select/README.md)** — Multi-select list with checkbox toggling (Space to toggle, Enter to submit)
- **[TextInput](src/components/text/README.md)** — Text input with cursor, mask, and focus system integration
- **[SearchInput](src/components/search-input/README.md)** — Search field with 🔍 icon and Esc-to-clear
- **[NumberInput](src/components/number-input/README.md)** — Numeric stepper with min/max/step and keyboard controls

### Display & Feedback
- **[Spinner](src/components/spinner/README.md)** — Animated spinner with multiple preset styles
- **[ProgressBar](src/components/progress-bar/README.md)** — Customizable progress bar with percentage display
- **[Badge](src/components/badge/README.md)** — Colored label/tag component
- **[KeyHint](src/components/key-hint/README.md)** — Keyboard shortcut hint bar (`[S] Save`)

### Navigation
- **[Tabs](src/components/tabs/README.md)** — Tabbed panel with keyboard navigation and focus system integration
- **[Fold](src/components/fold/README.md)** — Collapsible panel with preview and Space-toggle, integrated with focus system

### Layout
- **[Divider](src/components/divider/README.md)** — Horizontal separator with optional centered label

### Form
- **[Form & Field](src/components/form/README.md)** — Context‑based form system with validation, error focus, and Ctrl+Enter submit

### Dialog
- **[ConfirmDialog](src/components/dialog/README.md)** — Modal confirmation dialog with two buttons, designed for the overlay system

---

## Quick Overview

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
  overlay,
  closeOverlay,
  ConfirmDialog,
} from '@baigao_h/ink-kit';

// ── Register screens ──
function Menu() {
  const { skip } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['s'], () => skip(Game, { level: 1 }));
  }, []);
  return (
    <Box>
      <Text>Main Menu — Press S to start</Text>
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
      <Text>Level {level} — Press B to go back</Text>
    </Box>
  );
}
registerComponent(Game, { level: 1 }, { parent: Menu });

// Register the dialog so it can be used with overlay()
registerComponent(ConfirmDialog, {
  title: '', message: '', onConfirm: () => {}, onCancel: () => {},
});

// ── Wire up ──
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

## Coming Soon

More components are planned for deep integration into the keyboard and focus system, including Form.

## Other

I admit I thought about some things too quickly at the beginning of the project.
For example, the method of **blockedKeys**. Why is it called that? I don't know. Maybe I didn't think about it at that time.
Actually, it should be called **penetration**, but I don't want to change it.

## License

[MIT](LICENSE)
