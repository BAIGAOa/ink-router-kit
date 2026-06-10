# AGENTS.md

## Stack
- TypeScript 5.9, strict mode, Node16 modules, ES2022 target, JSX (`"jsx": "react"`)
- React 19 + Ink 7 (terminal UI framework)
- vitest 4.x with `@testing-library/react` + `ink-testing-library`
- No third-party state management — all React context + `useReducer`/`useRef`

## Commands
```bash
npm run build       # tsc --locale zh-CN
npm run watch       # tsc --watch --locale zh-CN
npm run test        # vitest run
npm run test:watch  # vitest
npm run clean       # rm -rf dist
```

## Layout
- `src/screen/` — tree-based screen navigation: register, skip, back, gotoScreen, overlay
- `src/keyboard/` — layered keyboard events with focus management and shortcut actions
- `src/components/` — SelectInput, MultiSelectInput, TextInput, NumberInput, SearchInput, ConfirmDialog, Spinner, ProgressBar, Divider, Badge, KeyHint, Tabs, Fold, Form (Field + context)
- `src/storage/` — typed JSON key-value persistence (`createStorage`)
- `src/binary-storage/` — sequential binary FIFO persistence (`createBinaryStorage`)
- `src/cli/` — ink-kit CLI (init, initTheme, makeLanguageType, makeThemeType)
- `src/language/` — i18n: `LanguageProvider` + `useI18n` hook
- `src/theme/` — theming: `ThemeProvider` + `useTheme` hook
- `src/index.ts` — public API barrel export
- `src/__tests__/` — tests organized by subsystem
- `dist/` — build output (.gitignored)

## Architecture

**Screen System** (`src/screen/`)
- Tree-based navigation via `registerComponent(Component, template, { parent })`.
- Navigation: `skip()` (down to child), `back()` (up to parent, supports `levels`), `gotoScreen()` (jump via LCA), `overlay()` / `closeOverlay()` (floating dialogs).
- All nav functions work as React hooks and as module-level imports (`_dispatchers` Set).
- `ScenarioManagementProvider` wraps the app; `CurrentScreen` renders the active screen.

**Keyboard System** (`src/keyboard/`)
- `KeyboardProvider` MUST be nested inside `ScenarioManagementProvider`.
- Priority chain: `globalKeys(affectOverlay:true)` → overlay → `globalKeys(affectOverlay:false)` → screen stack (top to bottom).
- Key mechanisms: `boundKeyboard()` (per-screen), `blockedKey()` (pass-through, confusingly named), `stop()`, `globalKeys()`.
- Focus: `useFocusState(focusId)`, Tab/Shift+Tab cycling, `focusSet/focusNext/focusPrev/focusUnregister`.
- Shortcut actions: `defineShortcutAction/addAction/hasAction/removeAction/modifyAction`.

**Component Library** (`src/components/`)
- 14 components, each in its own folder. All interactive ones use `focusId`.
- Form system (`Form` + `Field` + `useFormContext`) with validation context, Ctrl+Enter submit.

## Test Conventions
- `*.test.tsx` — jsdom via `@testing-library/react`; mock `useInput` to capture+dispatch synthetic keys.
- `*.ink.test.ts(x)` — node env via `ink-testing-library` for real Ink rendering.
- `clearRegistry()` in `beforeEach`; `clearDispatchers()` for module-level nav isolation.
- Test config in `vitest.config.ts` — default jsdom, `environmentMatchGlobs` for `.ink.test.*` → node.

## Coding Conventions

### JSX over React.createElement
New components MUST use JSX. Existing `React.createElement` in SelectInput and MultiSelectInput defaults is legacy — do NOT use it for new code.

### Focus target lifecycle
Separate `focusUnregister` from the keyboard binding `useEffect`. The binding effect may re-run on value changes; `focusUnregister` only on unmount.

```tsx
const focusIdRef = useRef(focusId);
focusIdRef.current = focusId;
useEffect(() => {
  return () => focusUnregister(focusIdRef.current);
}, []); // mount/unmount only

useEffect(() => {
  // boundKeyboard(...)
  return () => { /* unbind keyboard handlers only */ };
}, [value]);
```

### Callback refs in empty-deps effects
```tsx
const onCancelRef = useRef(onCancel);
onCancelRef.current = onCancel;
useEffect(() => {
  return boundKeyboard(['escape'], () => onCancelRef.current());
}, []);
```

### Defaults for prop accessors
All props accessed via `.length` / `.map()` must have runtime defaults:
```tsx
function KeyHint({ keys = [] }: Props) { ... }
function TextInput({ value = '' }: Props) { ... }
```

### globalKeys mode
Use `{ mode: 'add' }` when registering alongside other consumers. Default (replace) silently deletes entries from other components.

### Mount guard for async operations
```tsx
const mountedRef = useRef(true);
useEffect(() => { return () => { mountedRef.current = false; }; }, []);
```

### No decorative delimiter comments
Don't use banner comments (`// ──`). Explain **why**, not territory. Extract long sections into functions/files.

### Public API requires JSDoc in English
Every export in `src/index.ts` and every public type/function needs JSDoc describing **what** and **when to use it**. Internal helpers can omit.

### Hook encapsulation rule
When the same `useEffect` + `useRef` pattern appears in 3+ components, extract it into a custom hook. (Note: the `focusUnregister` pattern exists in 8+ components but hasn't been extracted yet — a candidate for `useFocusLifecycle`.)

### Test philosophy
Target **specific behaviors** that could break: edge cases, failure modes, state transitions, regressions. No "happy tests" that never fail. Cover real user flows, not line counts.

## Watch out for
- `blockedKey` means **pass-through** (penetration), NOT "block". Makes keys transparent to lower layers.
- `_dispatch` is set in `useEffect` — unavailable during `componentDidCatch`. Error boundaries calling `overlay()` will find `_dispatch` is `null`.
- `clearShortcutOperations` is a no-op at module level — keyboard state is per-instance via `useRef`.
- `ScenarioManagementProvider` nested first, then `KeyboardProvider` inside it. Reversed silently breaks keyboard.
- Overlay auto-closes on `skip`/`back`/`gotoScreen` (handled in reducer).
- Double `<` in TSX generics: `useRef<<T>` is parsed as JSX — must be `useRef<T>` (single).

## CI/CD
- GitHub CI: `npm ci` → `npm run build` → `npm test` on Node 22 & 24 for pushes/PRs to `main` and tags.
- On GitHub release publish: idempotency check → `npm publish --access public`.
