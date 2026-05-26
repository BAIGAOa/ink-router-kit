## ink-router-kit

> Ready-to-use Ink components and tools for building terminal UI applications.

[![CI](https://github.com/BAIGAOa/ink-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/BAIGAOa/ink-trc/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@baigao_h/ink-kit.svg)](https://www.npmjs.com/package/@baigao_h/ink-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


---

## Install

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

- **Blocked Key (blockedKey)** — Let a key pass through the current layer to be handled below
- **Stop (stop)** — Prevent a key from propagating to layers below
- **Global Key (globalKeys)** — Shortcuts independent of the screen stack

#### Finer-grained partitioning

Within the same level, identical keys are also in competition. To address this, we have a complete **focus system**.  
Each level maintains a set of focus targets, and only one focus is active at any given time within a level. Each focus target has its own bound keyboard operations. Only the activated focus target is eligible to execute them during event dispatching in **useInput**.  

**For more details, please refer to the API documentation.**
 

### Module-Level Functions

Navigation functions (`skip`, `back`, `gotoScreen`, etc.) work both inside React components (via hooks) and as **module-level imports** in any `.ts` / `.tsx` file. This allows non-UI layers — game engines, state managers, etc. — to trigger screen transitions.

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
- **[Keyboard System](src/keyboard/README.md)** — `KeyboardProvider`, `useKeyboard`, `boundKeyboard`, `blockedKey`, `stop`, `globalKeys`

---
## Documentation for the components

- **[SelectInput](src/components/select/README.md)** — Build your form from the comfort of your terminal
- **[TextInput](src/components/text/README.md)** — Construct the input line in the terminal, and cooperate with the focus system and the keyboard system
- **[MultiSelectInput](src/components/multi-select/README.md)** — Build a multi-select list and a task list in the terminal
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
## More

Because this is a special custom lightweight library that cannot be adapted to most components that rely on useInput, more components will be deeply integrated into this system in the future.


## License

[MIT](LICENSE)
