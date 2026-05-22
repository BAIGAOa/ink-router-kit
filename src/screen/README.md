
# Screen Management System

`ink-kit` provides a tree-based screen navigation system with **tree walking**, **cross-branch jumping**, and **overlay** support, allowing you to manage terminal UI screens like pages.

---

## Quick Start

```tsx
import React from 'react';
import { Box, Text, render } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  useScreenSystem,
} from '@baigao_h/ink-kit';

// 1. Register screen components
function Menu() {
  const { skip } = useScreenSystem();
  return (
    <Box flexDirection="column">
      <Text>Main Menu</Text>
      <Text>Press S to start</Text>
    </Box>
  );
}
registerComponent(Menu, {});

function Game({ level }: { level: number }) {
  const { back } = useScreenSystem();
  return (
    <Box>
      <Text>Level {level}</Text>
      <Text>Press B to go back</Text>
    </Box>
  );
}
registerComponent(Game, { level: 1 }, { parent: Menu });

// 2. Wrap with Provider, render CurrentScreen
function App() {
  return <CurrentScreen />;
}

render(
  <ScenarioManagementProvider defaultScreen={Menu}>
    <App />
  </ScenarioManagementProvider>,
);
```

---

## Concept: Screen Tree

Screens form a **tree** via the `parent` option of `registerComponent`:

```
Menu (root)
├── Settings
├── GameLevel
│   ├── Combat
│   └── Inventory
└── QuitConfirm
```

| Operation    | Description                                                      |
| ------------ | ---------------------------------------------------------------- |
| `skip`       | Walk down the tree to a direct child                             |
| `back`       | Walk up the tree to the parent                                  |
| `gotoScreen` | Jump across branches (finds the nearest common ancestor, rebuilds the path) |
| `overlay`    | Open a floating overlay independent of the tree (path unchanged) |

---

## API Reference

### `registerComponent`

```tsx
registerComponent(component, template, options?);
```

Register a component as a screen node.

| Parameter | Type                                    | Description                            |
| --------- | --------------------------------------- | -------------------------------------- |
| component | `React.ComponentType`                   | The component itself, used as unique token |
| template  | `React.ComponentProps<C>`               | Default props                          |
| options   | `{ parent?: React.ComponentType }` | Optional parent to build the tree      |

**Examples**

```tsx
registerComponent(Menu, {});                              // root node
registerComponent(Game, { level: 1 }, { parent: Menu });  // child of Menu
```

**Note**: A component cannot be registered more than once. Duplicate registration throws an error.

---

### `ScenarioManagementProvider`

```tsx
<ScenarioManagementProvider
  defaultScreen={Menu}
  defaultParams={{}}
>
  {children}
</ScenarioManagementProvider>
```

Root context provider wrapping the entire application.

| Prop          | Type                        | Required | Description                                |
| ------------- | --------------------------- | -------- | ------------------------------------------ |
| defaultScreen | `React.ComponentType`       | Yes      | Default screen (must be registered)         |
| defaultParams | `Record<string, unknown>`   | No       | Initial props; falls back to the registered template |

**Validation**: Throws if `defaultScreen` is not registered.

---

### `CurrentScreen`

```tsx
<CurrentScreen />
```

Renders the current top-of-stack screen and any active overlay.

- No overlay: renders only the stack-top component.
- With overlay: the screen renders underneath, the overlay on top (wrapped in `<Box>`).

---

### `useScreenSystem`

```tsx
const {
  currentScreen,   // ReactNode — the currently rendered screen element
  currentOverlay,  // ReactNode | null — the current overlay element
  currentPath,     // React.ComponentType[] — path from root to stack top
  skip,            // SkipFn
  back,            // BackFn
  gotoScreen,      // GotoScreenFn
  overlay,         // OverlayFn
  closeOverlay,    // CloseOverlayFn
} = useScreenSystem();
```

React hook returning the screen system API.

**Must be used inside `<ScenarioManagementProvider>`**, otherwise throws an error.

---

### `skip`

```tsx
skip(component, params, options?);
```

Navigate down the tree to a **direct child**.

| Parameter | Type                            | Description                                      |
| --------- | ------------------------------- | ------------------------------------------------ |
| component | `React.ComponentType`           | Target component (must be a direct child of the current screen) |
| params    | `React.ComponentProps<C>`       | Props passed to the component (merged with template) |
| options   | `{ onlyAttribute?: boolean }`   | Optional                                          |

**Validation**: Throws if the target is not a direct child of the current screen.

**`onlyAttribute` option**

When the target is the current component itself and `onlyAttribute: true`, only the props are updated (the React key is preserved, preventing remounting). The path depth does not increase.

```tsx
// Refresh current screen's params without deepening the path
skip(Menu, { title: 'New Title' }, { onlyAttribute: true });
```

---

### `back`

```tsx
back();
```

Navigate up the tree to the parent.

**Validation**: Throws if called at the root node.

---

### `gotoScreen`

```tsx
gotoScreen(component, params);
```

Jump to any registered screen, even across branches.

```tsx
// From Combat (Menu → GameLevel → Combat) jump directly to Settings (Menu → Settings)
gotoScreen(Settings, { theme: 'light' });
```

Automatically finds the nearest common ancestor and rebuilds the path.

**Validation**: Throws if the component is not registered.

---

### `overlay`

```tsx
overlay(component, params);
```

Open a floating overlay on top of the screen stack.

```tsx
overlay(PauseMenu, { message: 'Paused' });
```

- Only one overlay can be active at a time; a new overlay replaces the previous one.
- The overlay does **not** modify `currentPath`.
- Performing `skip` / `back` / `gotoScreen` **automatically closes** the overlay.

---

### `closeOverlay`

```tsx
closeOverlay();
```

Close the currently active overlay.

---

### Module-Level Functions

`skip`, `back`, `gotoScreen`, `overlay`, and `closeOverlay` can also be used as **module-level imports** without a React component context.

```tsx
import { skip, back, gotoScreen, overlay, closeOverlay } from '@baigao_h/ink-kit';

// Use anywhere in .ts/.tsx files
skip(Game, { level: 5 });
```

**Note**: Module-level functions require `<ScenarioManagementProvider>` to be mounted. Calling them before the provider is mounted throws an error.

---

## Type Safety

All navigation functions are type-safe — `skip`, `gotoScreen`, and `overlay` automatically infer prop types from your component:

```tsx
// Ok — type checks
skip(Game, { level: 1 });

// Type error: Game has no `title` prop
skip(Game, { title: 'hello' });
//   ^^^^^  TypeScript error
```

---

## Common Errors

| Error Message                                                | Cause                                         |
| ------------------------------------------------------------ | --------------------------------------------- |
| Component "xxx" is not registered. Please call registerComponent() first. | The component was not registered via `registerComponent` |
| "xxx" is not a child of "yyy".                               | `skip` target is not a direct child of the current screen |
| back() failed: already at root node, cannot go back.          | `back` was called at the root                 |
| skip() called before Provider was mounted.                    | Module-level function called before the provider was mounted |
```
Jump to any registered screen, even across branches.

```tsx
// From Combat (Menu → GameLevel → Combat) jump directly to Settings (Menu → Settings)
gotoScreen(Settings, { theme: 'light' });
```

Automatically finds the nearest common ancestor and rebuilds the path.

**Validation**: Throws if the component is not registered.

---

### `overlay`

```tsx
overlay(component, params);
```

Open a floating overlay on top of the screen stack.

```tsx
overlay(PauseMenu, { message: 'Paused' });
```

- Only one overlay can be active at a time; a new overlay replaces the previous one.
- The overlay does **not** modify `currentPath`.
- Performing `skip` / `back` / `gotoScreen` **automatically closes** the overlay.

---

### `closeOverlay`

```tsx
closeOverlay();
```

Close the currently active overlay.

---

### Module-Level Functions

`skip`, `back`, `gotoScreen`, `overlay`, and `closeOverlay` can also be used as **module-level imports** without a React component context.

```tsx
import { skip, back, gotoScreen, overlay, closeOverlay } from 'ink-trc';

// Use anywhere in .ts/.tsx files
skip(Game, { level: 5 });
```

**Note**: Module-level functions require `<ScenarioManagementProvider>` to be mounted. Calling them before the provider is mounted throws an error.

---

## Type Safety

All navigation functions are type-safe — `skip`, `gotoScreen`, and `overlay` automatically infer prop types from your component:

```tsx
// Ok — type checks
skip(Game, { level: 1 });

// Type error: Game has no `title` prop
skip(Game, { title: 'hello' });
//   ^^^^^  TypeScript error
```

---

## Common Errors

| Error Message                                                | Cause                                         |
| ------------------------------------------------------------ | --------------------------------------------- |
| Component "xxx" is not registered. Please call registerComponent() first. | The component was not registered via `registerComponent` |
| "xxx" is not a child of "yyy".                               | `skip` target is not a direct child of the current screen |
| back() failed: already at root node, cannot go back.          | `back` was called at the root                 |
| skip() called before Provider was mounted.                    | Module-level function called before the provider was mounted |
