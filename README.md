## ink-kit

> Ready-to-use Ink components and tools for building terminal UI applications.

[![CI](https://github.com/BAIGAOa/ink-trc/actions/workflows/ci.yml/badge.svg)](https://github.com/BAIGAOa/ink-trc/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ink-trc.svg)](https://www.npmjs.com/package/ink-trc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Install

```bash
npm install @baigao_h/ink-kit
```

### Requirements

| Dependency | Minimum Version |
| ---------- | --------------- |
| Node.js    | 20              |
| ink        | 5               |
| react      | 18              |

---

## Design Philosophy

ink-trc aims to make **screen management** and **keyboard event handling** in Ink applications composable, maintainable, and type-safe.

### Screen as Component

In ink-trc, **every React component is a "screen"**. Register them into a **screen tree** via `registerComponent`, then navigate the tree with `skip` / `back` / `gotoScreen`. This design makes screen navigation predictable and eliminates the chaos of hand-written conditional rendering (`if-else` / `switch`).

### Layered Keyboard Events

No more global `useInput` cluttered with `if-else` chains. ink-trc's keyboard system maintains **per-screen-layer** key bindings. Events bubble from **top to bottom** through the stack, with three key mechanisms:

- **Blocked Key (blockedKey)** — Let a key pass through the current layer to be handled below
- **Stop (stop)** — Prevent a key from propagating to layers below
- **Global Key (globalKeys)** — Shortcuts independent of the screen stack

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
} from 'ink-trc';

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

[AGPL-3.0](LICENSE)
