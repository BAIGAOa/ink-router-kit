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

 Operation       | Description                                                      |
 --------------- | ---------------------------------------------------------------- |
 `skip`          | Walk down the tree to a direct child                             |
 `back`          | Walk up the tree toward the root (default 1 level). Pass `back(n)` to go multiple levels |
 `gotoScreen`    | Jump across branches (finds the nearest common ancestor, rebuilds the path) |
 `openOverlay`   | Open a floating overlay with a unique ID                         |
 `closeOverlay`  | Close a specific overlay by ID                                   |
 `closeAllOverlays` | Close all open overlays at once                               |
 `activateOverlay` | Activate an overlay so it receives keyboard events           |
 `deactivateOverlay` | Deactivate an overlay so it stops receiving keyboard events|

---

## API Reference

### `registerComponent`

```tsx
registerComponent(component, template, options?);
```

Register a component as a screen node.

 Parameter | Type                                    | Description                            |
 --------- | --------------------------------------- | -------------------------------------- |
 component | `React.ComponentType`                   | The component itself, used as unique token |
 template  | `React.ComponentProps<C>`               | Default props                          |
 options   | `{ parent?: React.ComponentType }` | Optional parent to build the tree      |

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

 Prop          | Type                        | Required | Description                                |
 ------------- | --------------------------- | -------- | ------------------------------------------ |
 defaultScreen | `React.ComponentType`       | Yes      | Default screen (must be registered)         |
 defaultParams | `Record<string, unknown>`   | No       | Initial props; falls back to the registered template |

**Validation**: Throws if `defaultScreen` is not registered.

---

### `CurrentScreen`

```tsx
<CurrentScreen />
```

Renders the current top-of-stack screen and all displayed overlays.

- No overlays: renders only the stack-top component.
- With overlays: renders the screen first, then overlays on top in zIndex order (lowest zIndex rendered first, highest rendered last — on top visually). Each overlay is wrapped in `OverlayContext.Provider` for keyboard isolation.

---

### `useScreenSystem`

```tsx
const {
  currentScreen,      // ReactNode — the currently rendered screen element
  currentOverlays,    // ReactNode[] — all rendered overlay elements (sorted by zIndex)
  currentPath,        // React.ComponentType[] — path from root to stack top
  skip,               // SkipFn
  back,               // BackFn
  gotoScreen,         // GotoScreenFn
  openOverlay,        // OpenOverlayFn
  closeOverlay,       // CloseOverlayFn
  closeAllOverlays,   // CloseAllOverlaysFn
  activateOverlay,    // ActivateOverlayFn
  deactivateOverlay,  // DeactivateOverlayFn
  activeOverlayIds,   // string[] — IDs of overlays currently receiving keyboard events
  displayedOverlays,  // OverlayEntry[] — metadata for all displayed overlays
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

 Parameter | Type                            | Description                                      |
 --------- | ------------------------------- | ------------------------------------------------ |
 component | `React.ComponentType`           | Target component (must be a direct child of the current screen) |
 params    | `React.ComponentProps<C>`       | Props passed to the component (merged with template) |

**Validation**: Throws if the target is not a direct child of the current screen.

---

### `back`

```tsx
back(levels?);
```

Navigate up the tree toward the root.

| Parameter | Type     | Default | Description                                |
| --------- | -------- | ------- | ------------------------------------------ |
| levels    | `number` | `1`     | Number of levels to go back. Must be >= 1. |

```tsx
back();      // go back 1 level (parent)
back(2);     // go back 2 levels at once
```

**Validation**:
- Throws if `levels < 1`.
- Throws if at the root node (`levels >= current depth`).

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

### `openOverlay`

```tsx
openOverlay(id, component, params, options?);
```

Open a floating overlay on top of the screen stack. Multiple overlays can coexist, distinguished by unique IDs.

```tsx
openOverlay('pause-1', PauseMenu, { message: 'Paused' });
openOverlay('notif-1', Notification, { message: 'Item collected!' }, { zIndex: 10 });
```

| Parameter | Type                          | Description                                      |
| --------- | ----------------------------- | ------------------------------------------------ |
| id        | `string`                      | Unique identifier for this overlay               |
| component | `React.ComponentType`         | Overlay component (must be registered)           |
| params    | `React.ComponentProps<C>`     | Props passed to the overlay                      |
| options   | `OpenOverlayOptions`          | Optional: `{ activate?: boolean, zIndex?: number }` |

**Options**:
- `activate` — Whether to activate the overlay immediately (default `true`). Inactive overlays render but don't receive keyboard events.
- `zIndex` — Visual stacking order. Smaller values render behind larger values. Defaults to the current overlay count.

**Key points**:
- Multiple overlays can be open simultaneously, each with a unique ID.
- Overlays do **not** modify `currentPath`.
- Performing `skip` / `back` / `gotoScreen` **automatically closes all** overlays.
- Reusing an existing ID throws an error.

---

### `closeOverlay`

```tsx
closeOverlay(id);
```

Close a specific overlay by its ID.

```tsx
closeOverlay('pause-1');
```

Throws if no overlay with the given ID exists.

---

### `closeAllOverlays`

```tsx
closeAllOverlays();
```

Close all open overlays at once.

---

### `activateOverlay`

```tsx
activateOverlay(id);
```

Activate an overlay by its ID so it starts receiving keyboard events.

Throws if no overlay with the given ID exists.

---

### `deactivateOverlay`

```tsx
deactivateOverlay(id);
```

Deactivate an overlay by its ID so it stops receiving keyboard events while staying visible.

Throws if no overlay with the given ID exists.

---

### Module-Level Functions

`skip`, `back`, `gotoScreen`, `openOverlay`, `closeOverlay`, `closeAllOverlays`, `activateOverlay`, and `deactivateOverlay` can also be used as **module-level imports** without a React component context.

```tsx
import { skip, back, gotoScreen, openOverlay, closeOverlay } from '@baigao_h/ink-kit';

// Use anywhere in .ts/.tsx files
skip(Game, { level: 5 });
openOverlay('pause', PauseMenu, {});
closeOverlay('pause');
```

**Note**: Module-level functions require `<ScenarioManagementProvider>` to be mounted. Calling them before the provider is mounted throws an error.

---

## Type Safety

All navigation functions are type-safe — `skip`, `gotoScreen`, and `openOverlay` automatically infer prop types from your component:

```tsx
// Ok — type checks
skip(Game, { level: 1 });
openOverlay('dialog', ConfirmDialog, { message: 'Are you sure?' });

// Type error: Game has no `title` prop
skip(Game, { title: 'hello' });
//   ^^^^^  TypeScript error
```

---

## Common Errors

 Error Message                                                | Cause                                         |
 ------------------------------------------------------------ | --------------------------------------------- |
 Component "xxx" is not registered. Please call registerComponent() first. | The component was not registered via `registerComponent` |
 "xxx" is not a child of "yyy".                               | `skip` target is not a direct child of the current screen |
 back() failed: already at root node, cannot go back.          | `back` was called at the root                 |
 skip() called before Provider was mounted.                    | Module-level function called before the provider was mounted |
 Overlay with id "xxx" already exists.                        | `openOverlay` called with an ID that is already in use |
 Cannot close overlay "xxx": no overlay with that ID exists.   | `closeOverlay` called with an unknown ID       |
 Cannot activate overlay "xxx": no overlay with that ID exists. | `activateOverlay` called with an unknown ID    |
 Cannot deactivate overlay "xxx": no overlay with that ID exists. | `deactivateOverlay` called with an unknown ID  |
