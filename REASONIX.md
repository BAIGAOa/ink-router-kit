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

## Watch out for
- `blockedKey` means "pass-through" (penetration), NOT "block" — makes keys transparent to lower layers
- `_dispatch` is set in `useEffect` — not available during `componentDidCatch`. If an error boundary calls `overlay()` in `componentDidCatch`, `_dispatch` is `null`
- `clearShortcutOperations` is a no-op at module level — keyboard state is per-instance via `useRef`
- `ScenarioManagementProvider` nested first, then `KeyboardProvider` inside it. Reversed order silently breaks keyboard
- Overlay automatically closes on `skip`/`back`/`gotoScreen` (handled in reducer)
- Double `<` in TSX generics e.g. `useRef<<T>` is parsed as JSX tag — must be `useRef<T>` (single)
