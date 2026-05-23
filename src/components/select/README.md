# SelectInput

A single-select list component deeply integrated with the `ink-router-kit` keyboard and focus system.

## Install

```bash
npm install @baigao_h/ink-router-kit
```

## Quick Start

```tsx
import React from 'react';
import { Box, render } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  useKeyboard,
  KeyboardProvider,
  SelectInput,
} from '@baigao_h/ink-router-kit';

function App() {
  const { boundKeyboard } = useKeyboard();

  React.useEffect(() => {
    boundKeyboard(['q'], () => process.exit(0));
  }, []);

  return <CurrentScreen />;
}

function Menu() {
  return (
    <Box flexDirection="column" padding={1}>
      <SelectInput
        focusId="menu"
        items={[
          { label: 'Start Game', value: 'start' },
          { label: 'Setting', value: 'settings' },
          { label: 'Exit', value: 'exit' },
        ]}
        onSelect={(item) => console.log('select:', item.value)}
      />
    </Box>
  );
}

registerComponent(Menu, {});

render(
  <ScenarioManagementProvider defaultScreen={Menu}>
    <KeyboardProvider>
      <App />
    </KeyboardProvider>
  </ScenarioManagementProvider>,
);
```

## Props

### `focusId: string` (required)

The focus target identifier for this SelectInput instance. It is registered on the current screen's keyboard layer. When multiple SelectInputs exist on the same screen, users cycle between them with `Tab` / `Shift+Tab`. Only the currently active focus target receives key events.

```tsx
<SelectInput focusId="playerList" items={players} onSelect={handleSelect} />
<SelectInput focusId="itemList" items={items} onSelect={handleSelect} />
```

### `items: Item<T>[]` (required)

The list of selectable items. Each item must have a `label` (display text) and a `value`. An optional `Key` can be supplied for React list rendering.

```ts
interface Item<T = unknown> {
  label: string;
  value: T;
  Key?: string;
}
```

```tsx
const items = [
  { label: 'Sweden', value: 'SE' },
  { label: 'Norway', value: 'NO', Key: 'norway' },
];
```

### `onSelect: (item: Item<T>) => void` (required)

Called when the user presses `Enter` or a number key (`1`–`9`) on a visible item.

### `itemComponent?: React.ComponentType<I & { isSelected: boolean }>`

Custom renderer for each item. Receives the item's fields plus `isSelected` (boolean, whether the highlight cursor is on this item).

```tsx
<SelectInput
  focusId="files"
  items={files}
  onSelect={openFile}
  itemComponent={({ label, isSelected }) => (
    <Text color={isSelected ? 'green' : 'white'}>{label}</Text>
  )}
/>
```

### `indicatorComponent?: React.ComponentType<{ isSelected: boolean }>`

Custom indicator rendered before each item. Default: a blue `❯` character when selected, otherwise a blank space.

```tsx
<SelectInput
  focusId="menu"
  items={items}
  onSelect={handleSelect}
  indicatorComponent={({ isSelected }) => (
    <Text color="yellow">{isSelected ? '▶' : ' '}</Text>
  )}
/>
```

## Keyboard Bindings

| Key | Action |
|-----|--------|
| `↑` / `k` | Move highlight up |
| `↓` / `j` | Move highlight down |
| `Enter` | Confirm selection |
| `1 – 9` | Directly select the visible item at that position |
| `Tab` | Move focus to the next SelectInput (handled by the keyboard system) |
| `Shift+Tab` | Move focus to the previous SelectInput (handled by the keyboard system) |

All key bindings are automatically registered on the focus target identified by `focusId`. When the component unmounts, all bindings are removed and the focus target is unregistered.

## Focus Integration

SelectInput is designed to work with `ink-router-kit`'s keyboard and focus system — no extra setup required.

- Each instance registers a **focus target** on the current screen's keyboard layer via its `focusId`.
- When the component is **unfocused**, its items are visually dimmed and **no key events are delivered** — arrow keys and Enter are ignored.
- When the component is **focused**, it receives arrow keys, Enter, and number keys.
- Pressing `Tab` cycles focus to the next `focusId` registered on the same screen; `Shift+Tab` cycles backward.
- On unmount, the focus target is automatically unregistered. If it was the active focus target, focus falls back to the first remaining target on the layer.

**Multiple SelectInputs on the same screen work without conflict:**

```tsx
function Settings() {
  return (
    <Box flexDirection="column">
      <SelectInput
        focusId="difficulty"
        items={[
          { label: 'Easy', value: 'easy' },
          { label: 'Normal', value: 'normal' },
          { label: 'Hard', value: 'hard' },
        ]}
        onSelect={setDifficulty}
      />
      <SelectInput
        focusId="language"
        items={[
          { label: 'English', value: 'en' },
          { label: '中文', value: 'zh' },
        ]}
        onSelect={setLanguage}
      />
    </Box>
  );
}
```

Press `Tab` to switch between the difficulty and language lists. Arrow keys only affect the currently focused list.

## Virtual Scrolling

When `items.length > 10`, only 10 items are rendered at a time. Scrolling is handled automatically as the highlight moves — items outside the visible window are unmounted. Number keys `1`–`9` always map to the currently visible items.

## Type Parameters

```ts
SelectInput<T, I extends Item<T>>(props: SelectInputProps<T, I>)
```

- `T` — the type of `item.value`.
- `I` — the extended item type (must include `label`, `value`, and optionally `Key`). Defaults to `Item<T>`.

```tsx
interface Country extends Item<string> {
  flag: string;
}

const countries: Country[] = [
  { label: 'Sweden', value: 'SE', flag: '🇸🇪' },
  { label: 'Japan', value: 'JP', flag: '🇯🇵' },
];

<SelectInput<string, Country>
  focusId="countries"
  items={countries}
  onSelect={handleSelect}
  itemComponent={({ label, flag, isSelected }) => (
    <Text color={isSelected ? 'blue' : 'white'}>
      {flag} {label}
    </Text>
  )}
/>;
```

## Lifecycle

1. **Mount**: SelectInput registers `focusId` on the current screen's keyboard layer. If this is the first focus target on the layer, it becomes the active target immediately.
2. **Active**: When the focus target is active, arrow keys and Enter are dispatched to this instance.
3. **Inactive**: When another focus target becomes active, this instance stops receiving key events. Items remain rendered but appear dimmed.
4. **Unmount**: All key bindings are removed, and the focus target is unregistered. Focus moves to the next available target on the layer.

## License

MIT
