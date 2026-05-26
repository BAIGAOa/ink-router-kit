# MultiSelectInput

Multi-select list component for [Ink](https://github.com/vadimdemedes/ink), integrated with the ink-kit keyboard and focus system.

Users navigate with arrow keys (or vim-style `j`/`k`), toggle items with **Space**, and confirm with **Enter**. Number keys `1`–`9` toggle the corresponding visible item directly.

## Quick Start

```tsx
import { render, Box, Text } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  KeyboardProvider,
  MultiSelectInput,
} from '@baigao_h/ink-kit';

const items = [
  { label: 'Red',   value: 'red' },
  { label: 'Green', value: 'green' },
  { label: 'Blue',  value: 'blue' },
];

function App() {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <Box flexDirection="column">
      <MultiSelectInput
        focusId="colors"
        items={items}
        selected={selected}
        onChange={setSelected}
      />
      <Text>Selected: {selected.join(', ') || 'none'}</Text>
    </Box>
  );
}

registerComponent(App, {});

render(
  <ScenarioManagementProvider defaultScreen={App}>
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  </ScenarioManagementProvider>
);
```

## Controlled vs Uncontrolled

**Controlled** — pass `selected` and `onChange`:

```tsx
const [selected, setSelected] = useState<string[]>(['green']);
<MultiSelectInput
  focusId="colors"
  items={items}
  selected={selected}
  onChange={setSelected}
/>
```

**Uncontrolled** — use `defaultSelected` and `onSubmit`:

```tsx
<MultiSelectInput
  focusId="colors"
  items={items}
  defaultSelected={['green']}
  onSubmit={(vals) => console.log('Confirmed:', vals)}
/>
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `↑` `↓` / `j` `k` | Move highlight up/down |
| `Space` | Toggle selection on highlighted item |
| `Enter` | Submit current selection (`onSubmit`) |
| `1`–`9` | Toggle the Nth visible item |

When the component is **not** the active focus target (e.g. another input has focus), all keyboard events are automatically ignored. The visual highlight is hidden, but selection checkboxes remain visible.

## Props

### `items`

Items to display. Each item must have `label` and `value`, and may optionally have a `Key` for the React key (falls back to `String(value)`).

```ts
type Item<T> = {
  label: string;
  value: T;
  Key?: string;
};
```

### `focusId` (required)

Unique focus identifier on the current screen. The keyboard system routes events to the component whose `focusId` matches the active focus target.

```tsx
<MultiSelectInput focusId="shopping-cart" items={products} ... />
```

### `selected` / `defaultSelected`

| Prop | Type | Description |
|---|---|---|
| `selected` | `T[]` | Controlled: values currently selected |
| `defaultSelected` | `T[]` | Uncontrolled: values selected on mount (default `[]`) |

Only one should be used at a time. When `selected` is provided, the component is fully controlled.

### `onChange`

```ts
onChange?: (selected: T[]) => void
```

Called whenever the set of selected values changes (both modes). Receives the full array of currently selected values.

### `onSubmit`

```ts
onSubmit?: (selected: T[]) => void
```

Called when the user presses **Enter**. Receives the full array of currently selected values.

### `onSelect` / `onUnselect`

```ts
onSelect?: (item: I) => void
onUnselect?: (item: I) => void
```

Called when an individual item is toggled on or off, respectively. Receives the full item object.

### `onHighlight`

```ts
onHighlight?: (item: I) => void
```

Called whenever the highlight cursor moves to a different item. Also fires once on mount for the initial highlighted item.

### `limit`

```ts
limit?: number  // default: 10
```

Maximum number of visible items before scrolling is enabled. When `items.length > limit`, only `limit` items are rendered at a time, and the viewport scrolls as the highlight moves.

### `initialIndex`

```ts
initialIndex?: number  // default: 0
```

Index of the initially highlighted item (0-based, within the visible window).

### `indicatorComponent`

```ts
indicatorComponent?: React.ComponentType<{ isHighlighted: boolean }>
```

Custom component rendered before the checkbox. Receives `isHighlighted` to indicate whether the cursor is on this row.

**Default**: blue `❯` when highlighted, blank space otherwise.

```tsx
const StarIndicator = ({ isHighlighted }) => (
  <Box marginRight={1}>
    <Text color={isHighlighted ? 'yellow' : undefined}>
      {isHighlighted ? '★' : ' '}
    </Text>
  </Box>
);
```

### `checkboxComponent`

```ts
checkboxComponent?: React.ComponentType<{ isSelected: boolean }>
```

Custom component rendered between the indicator and the item label. Receives `isSelected` to indicate whether the item is checked.

**Default**: green `◉` when selected, `○` otherwise.

```tsx
const BracketedCheckbox = ({ isSelected }) => (
  <Box marginRight={1}>
    <Text color="green">{isSelected ? '[x]' : '[ ]'}</Text>
  </Box>
);
```

### `itemComponent`

```ts
itemComponent?: React.ComponentType<I & { isHighlighted: boolean }>
```

Custom item renderer. Receives all item properties plus `isHighlighted`.

**Default**: blue label when highlighted, default color otherwise.

```tsx
const StyledItem = ({ label, isHighlighted }) => (
  <Text color={isHighlighted ? 'cyanBright' : 'grey'} bold={isHighlighted}>
    {label}
  </Text>
);
```

## Scrolling

When `items.length > limit`, the list scrolls as the user navigates:

```
Items: [A, B, C, D, E, F, G, H, I, J, K, L]   limit=5

Frame 1:  ❯ A    ○ B    ○ C    ○ D    ○ E
Frame 2:    ○ B    ○ C    ○ D    ○ E  ❯ F
Frame 3:    ○ C    ○ D    ○ E    ○ F  ❯ G
```

The highlight position and scroll offset are managed internally. Number keys always toggle the Nth item in the current visible window.

## Focus System Integration

Multiple form components (SelectInput, TextInput, MultiSelectInput) on the same screen share the keyboard via the focus system:

```tsx
function Form() {
  return (
    <Box flexDirection="column">
      <TextInput focusId="name" value={name} onChange={setName} />
      <MultiSelectInput
        focusId="colors"
        items={colorItems}
        selected={colors}
        onChange={setColors}
      />
    </Box>
  );
}
```

- The first registered focus target gets focus automatically.
- `Tab` / `Shift+Tab` cycle through targets (handled by the keyboard system).
- `focusSet(id)` / `focusNext()` / `focusPrev()` provide programmatic control.
- Only the active focus target receives keyboard events.
- Unfocused MultiSelectInputs hide their highlight but still show checkboxes.

Use `useKeyboard()` and `useFocusState(id)` to build custom focus-aware components.

## Comparison with SelectInput

| Feature | SelectInput | MultiSelectInput |
|---|---|---|
| Selection model | Single (radio) | Multiple (checkbox) |
| Confirm key | `Enter` selects one | `Space` toggles, `Enter` submits all |
| Visual | `❯` indicator only | `❯` indicator + `◉`/`○` checkbox |
| Callbacks | `onSelect(item)` | `onChange(values[])`, `onSubmit(values[])`, `onSelect`/`onUnselect` |
| Controlled | N/A | `selected` + `onChange` |
| Number keys | Select Nth item | Toggle Nth item |
| Scrolling | Yes | Yes |
| Focus system | Yes | Yes |
