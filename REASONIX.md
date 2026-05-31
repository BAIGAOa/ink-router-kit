# REASONIX.md

## Stack
- TypeScript 5.x, strict mode, Node16 modules, ES2022 target
- React 19 + Ink 7 (terminal UI framework)
- vitest 4.x with `@testing-library/react` + `ink-testing-library`

## Layout
- `src/screen/` — tree-based screen navigation: register, skip, back, gotoScreen, overlay
- `src/keyboard/` — layered keyboard events with focus management and shortcut actions
- `src/components/` — SelectInput, MultiSelectInput, TextInput, ConfirmDialog
- `src/index.ts` — public API barrel export
- `src/__tests__/` — all tests organized by subsystem
- `src/projectTest/` — manual test/demo screens (not part of build)
- `dist/` — build output (.gitignored)

## Commands
```bash
npm run build       # tsc --locale zh-CN
npm run watch       # tsc --watch --locale zh-CN
npm run test        # vitest run
npm run test:watch  # vitest
npm run clean       # rm -rf dist
```

## Conventions
- Components use **JSX** syntax. `React.createElement` in existing code is a historical legacy from before the project adopted JSX — do NOT use it for new components.
- Tests under `src/__tests__/` — `*.ink.test.ts(x)` runs in node env, `*.test.ts(x)` in jsdom
- `registerComponent()` required before any screen appears in a provider tree
- `clearRegistry()` in test `beforeEach` — registry is a module-level Map
- Navigation functions (`skip`, `back`, `gotoScreen`, `overlay`, `closeOverlay`) work both as hooks and module-level imports via `_dispatch` ref
- `KeyboardProvider` MUST be nested inside `ScenarioManagementProvider`

## Coding Conventions

### Focus target lifecycle
Separate `focusUnregister` from the keyboard binding `useEffect`. The binding effect may re-run on value changes; `focusUnregister` should only run on unmount.

```tsx
const focusIdRef = useRef(focusId);
focusIdRef.current = focusId;
useEffect(() => {
  return () => focusUnregister(focusIdRef.current);
}, []); // mount/unmount only

useEffect(() => {
  // boundKeyboard(...)
  return () => { /* unbind keyboard handlers only */ };
}, [value, /* ... */]);
```

### Callback refs in empty-deps effects
When a `useEffect` has `[]` deps, capture callbacks via `useRef` to avoid stale closures.

```tsx
const onCancelRef = useRef(onCancel);
onCancelRef.current = onCancel;
useEffect(() => {
  return boundKeyboard(['escape'], () => onCancelRef.current());
}, []);
```

### Defaults for prop accessors
All props whose values are accessed via `.length` / `.map()` / etc. must have a runtime default.

```tsx
function KeyHint({ keys = [] }: Props) { ... }
function TextInput({ value = '' }: Props) { ... }
```

### globalKeys mode
Use `{ mode: 'add' }` when registering global keys alongside other consumers. Default (replace) silently deletes entries from other components.

```tsx
globalKeys([{ key: 'ctrl+s', operate: handleSubmit }], { mode: 'add' });
```

### Mount guard for async operations
Use a `mountedRef` to prevent callbacks from running after unmount.

```tsx
const mountedRef = useRef(true);
useEffect(() => { return () => { mountedRef.current = false; }; }, []);
```

## Watch out for
- `blockedKey` means "pass-through" (penetration), NOT "block" — makes keys transparent to lower layers
- `_dispatch` is set in `useEffect` — not available during `componentDidCatch`. If an error boundary calls `overlay()` in `componentDidCatch`, `_dispatch` is `null`
- `clearShortcutOperations` is a no-op at module level — keyboard state is per-instance via `useRef`
- `ScenarioManagementProvider` nested first, then `KeyboardProvider` inside it. Reversed order silently breaks keyboard
- Overlay automatically closes on `skip`/`back`/`gotoScreen` (handled in reducer)
- Double `<` in TSX generics e.g. `useRef<<T>` is parsed as JSX tag — must be `useRef<T>` (single)
