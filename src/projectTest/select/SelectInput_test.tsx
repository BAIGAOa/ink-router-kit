import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  useScreenSystem,
  useKeyboard,
  KeyboardProvider,
} from '../../index.js';
import { SelectInput } from '../../components/select/SelectInput.js';
import type { Item } from '../../components/select/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Demo Data — Item arrays used by SelectInput instances
// ═══════════════════════════════════════════════════════════════════════════

/** Navigation options shown on the main menu */
const menuItems: Item<string>[] = [
  { label: '⚙  Settings Demo  (multiple SelectInputs + Tab focus)', value: 'settings' },
  { label: '⚔  Game Demo       (long scrolling list + custom render)', value: 'game' },
  { label: '✕  Quit', value: 'quit' },
];

/** Theme options with simple string values */
const themeItems: Item<string>[] = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'Cyberpunk', value: 'cyberpunk' },
  { label: 'Retro Wave', value: 'retro' },
  { label: 'Solarized', value: 'solarized' },
];

/** Difficulty levels */
const difficultyItems: Item<string>[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Normal', value: 'normal' },
  { label: 'Hard', value: 'hard' },
  { label: 'Expert', value: 'expert' },
  { label: 'Nightmare', value: 'nightmare' },
];

/**
 * Weapon list — deliberately longer than 10 items to trigger the
 * built-in scroll window inside SelectInput.
 */
const weaponItems: Item<string>[] = [
  { label: 'Wooden Sword', value: 'wooden_sword' },
  { label: 'Iron Sword', value: 'iron_sword' },
  { label: 'Steel Blade', value: 'steel_blade' },
  { label: 'Flame Sword', value: 'flame_sword' },
  { label: 'Ice Dagger', value: 'ice_dagger' },
  { label: 'Lightning Axe', value: 'lightning_axe' },
  { label: 'Shadow Bow', value: 'shadow_bow' },
  { label: 'Crystal Staff', value: 'crystal_staff' },
  { label: 'Dragon Lance', value: 'dragon_lance' },
  { label: 'Void Hammer', value: 'void_hammer' },
  { label: 'Phoenix Wand', value: 'phoenix_wand' },
  { label: 'Thunder Mace', value: 'thunder_mace' },
  { label: 'Silver Rapier', value: 'silver_rapier' },
  { label: 'Titan Gauntlets', value: 'titan_gauntlets' },
  { label: 'Mystic Orb', value: 'mystic_orb' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Custom Renderers — demonstrate indicatorComponent / itemComponent props
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A star-based indicator that replaces the default blue arrow.
 * Shows a filled star when the row is selected, otherwise a blank space.
 */
function StarIndicator({ isSelected }: { isSelected: boolean }) {
  return React.createElement(
    Box,
    { marginRight: 1 },
    isSelected
      ? React.createElement(Text, { color: 'yellow' }, '★')
      : React.createElement(Text, null, ' '),
  );
}

/**
 * A custom item renderer that displays additional metadata when the
 * row is highlighted.  Selected rows show a sword icon and the internal
 * value; unselected rows are dimmed.
 */
function WeaponItem({
  label,
  value,
  isSelected,
}: {
  label: string;
  value: string;
  isSelected: boolean;
}) {
  return React.createElement(
    Text,
    { color: isSelected ? 'greenBright' : 'grey', dimColor: !isSelected },
    isSelected ? `⚔  ${label}  [id: ${value}]` : `   ${label}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Screen: MainMenu
//   Demonstrates a single SelectInput used as a navigation menu.
//   Press Enter on an item to navigate; Q quits the application.
// ═══════════════════════════════════════════════════════════════════════════

function MainMenu() {
  const { skip } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  // Global quit key — always available on this screen
  useEffect(() => {
    boundKeyboard(['q'], () => process.exit());
  }, []);

  /**
   * Handle menu selection: map each item's value to a navigation action.
   * `skip` walks down the registered screen tree to a direct child.
   */
  const handleMenuSelect = (item: Item<string>) => {
    switch (item.value) {
      case 'settings':
        skip(SettingsDemo, {});
        break;
      case 'game':
        skip(GameDemo, {});
        break;
      case 'quit':
        process.exit();
        break;
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        ╔══════════════════════════════════════════════╗
      </Text>
      <Text bold color="cyan">
        ║         SelectInput Component Demo           ║
      </Text>
      <Text bold color="cyan">
        ╚══════════════════════════════════════════════╝
      </Text>

      <Text>{' '}</Text>
      <Text dimColor>
        Use ↑/↓ or j/k to move  ·  Enter to confirm  ·  1-9 quick-select
      </Text>
      <Text dimColor>
        Press Q at any time to quit the application
      </Text>
      <Text>{' '}</Text>
      <Text bold>Choose a demo scenario:</Text>
      <Text>{' '}</Text>

      {/* The main menu itself is a SelectInput — focusId anchors it on this screen */}
      {/* @ts-expect-error – generic inference quirk; runtime behaviour is correct */}
      <SelectInput<string>
        items={menuItems}
        onSelect={handleMenuSelect}
        focusId="menu-nav"
      />

      <Text>{' '}</Text>
      <Text dimColor>
        ─────────────────────────────────────────────
      </Text>
    </Box>
  );
}
registerComponent(MainMenu, {});

// ═══════════════════════════════════════════════════════════════════════════
// Screen: SettingsDemo
//   Demonstrates TWO SelectInputs on the same screen.  Press Tab /
//   Shift+Tab to switch focus between them.  The active one shows a
//   blue ▶ indicator; the inactive one appears dimmed.
//
//   Selection state is tracked in local useState so you can see the
//   result update live.
// ═══════════════════════════════════════════════════════════════════════════

function SettingsDemo() {
  const { back } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  // Track the currently chosen values so the UI can reflect them
  const [theme, setTheme] = useState<string>('dark');
  const [difficulty, setDifficulty] = useState<string>('normal');

  // Back-navigation key — only active while this screen is on top
  useEffect(() => {
    boundKeyboard(['b', 'escape'], () => back());
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="yellow">
        ┌─ Settings Demo ──────────────────────────────┐
      </Text>
      <Text dimColor>
        │  Tab / Shift+Tab → switch focus between inputs │
      </Text>
      <Text dimColor>
        │  ↑/↓ or j/k → move highlight                   │
      </Text>
      <Text dimColor>
        │  Enter → confirm  ·  1-5 → quick-select         │
      </Text>
      <Text dimColor>
        │  B or Esc → back to menu                        │
      </Text>
      <Text>{' '}</Text>

      {/* ── Theme SelectInput ── */}
      <Text bold underline>
        Theme
      </Text>
      {/* @ts-expect-error – generic inference quirk */}
      <SelectInput<string>
        items={themeItems}
        onSelect={(item) => setTheme(item.value)}
        focusId="theme-select"
      />
      <Text color="green">  → Current theme: {theme}</Text>

      <Text>{' '}</Text>

      {/* ── Difficulty SelectInput ── */}
      <Text bold underline>
        Difficulty
      </Text>
      {/* @ts-expect-error – generic inference quirk */}
      <SelectInput<string>
        items={difficultyItems}
        onSelect={(item) => setDifficulty(item.value)}
        focusId="difficulty-select"
      />
      <Text color="green">  → Current difficulty: {difficulty}</Text>

      <Text>{' '}</Text>
      <Text dimColor>
        └────────────────────────────────────────────────┘
      </Text>
      <Text>{' '}</Text>
      <Text color="grey">
        💡 The first registered focus target (Theme) is auto-activated.
      </Text>
      <Text color="grey">
        💡 Press Tab to see the ▶ indicator jump to Difficulty.
      </Text>
    </Box>
  );
}
registerComponent(SettingsDemo, {}, { parent: MainMenu });

// ═══════════════════════════════════════════════════════════════════════════
// Screen: GameDemo
//   Demonstrates a SelectInput with MORE THAN 10 ITEMS.  The component
//   automatically limits the visible window to 10 rows and scrolls as
//   you move the highlight.
//
//   Also uses a CUSTOM indicator (★) and a CUSTOM item renderer
//   (shows the internal value id when highlighted).
// ═══════════════════════════════════════════════════════════════════════════

function GameDemo() {
  const { back } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  const [weapon, setWeapon] = useState<string>('none');

  useEffect(() => {
    boundKeyboard(['b', 'escape'], () => back());
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="magenta">
        ┌─ Game Demo (Scrolling List) ─────────────────┐
      </Text>
      <Text dimColor>
        │  This list has {weaponItems.length} items — only 10 visible at once  │
      </Text>
      <Text dimColor>
        │  Move highlight past the window to scroll      │
      </Text>
      <Text dimColor>
        │  Custom ★ indicator + custom item renderer      │
      </Text>
      <Text dimColor>
        │  B or Esc → back to menu                        │
      </Text>
      <Text>{' '}</Text>

      <Text bold underline>
        Choose Your Weapon
      </Text>
      <Text>{' '}</Text>

      
      <SelectInput<string>
        items={weaponItems}
        onSelect={(item) => setWeapon(item.value)}
        focusId="weapon-select"
        indicatorComponent={StarIndicator}
        itemComponent={WeaponItem as any}
      />

      <Text>{' '}</Text>
      <Text color="greenBright">  ⚔ Equipped: {weapon}</Text>

      <Text>{' '}</Text>
      <Text dimColor>
        └────────────────────────────────────────────────┘
      </Text>
      <Text>{' '}</Text>
      <Text color="grey">
        💡 Try pressing 5 to quick-jump to the 5th visible item.
      </Text>
      <Text color="grey">
        💡 Scroll down past item #10 to see the list window move.
      </Text>
    </Box>
  );
}
registerComponent(GameDemo, {}, { parent: MainMenu });

// ═══════════════════════════════════════════════════════════════════════════
// App root — wires up the keyboard provider and renders the current screen
// ═══════════════════════════════════════════════════════════════════════════

function App() {
  return (
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Entry point — mount the screen-management provider with the main menu
// ═══════════════════════════════════════════════════════════════════════════

render(
  <ScenarioManagementProvider defaultScreen={MainMenu}>
    <App />
  </ScenarioManagementProvider>,
);
