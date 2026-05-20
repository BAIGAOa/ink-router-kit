import React, { useEffect } from 'react';
import { render, Box, Text } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  useScreenSystem,
  useKeyboard,
  KeyboardProvider,
} from '../index.js';

function Menu() {
  const { skip } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    boundKeyboard(['s'], () => skip(Settings, {}));
    boundKeyboard(['g'], () => skip(Game, {}));
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>┌─ Main Menu ──────────────────────────────┐</Text>
      <Text>│  [S] Settings    [G] Start Game           │</Text>
      <Text>│  [E] Global e (cover: true)               │</Text>
      <Text>│  [X] Global x (affectOverlay: true)        │</Text>
      <Text>│  [Q] Quit (cover: false)                   │</Text>
      <Text>└───────────────────────────────────────────┘</Text>
    </Box>
  );
}
registerComponent(Menu, {});

function Settings() {
  const { back } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    boundKeyboard(['backspace'], () => back());
    boundKeyboard(['e'], () => console.log('[Settings] e 被覆盖'));
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>┌─ Settings ───────────────────────────────┐</Text>
      <Text>│  [Backspace] Back                         │</Text>
      <Text>│  [E] 覆盖全局 e (cover: true 允许)         │</Text>
      <Text>│  [N] 全局 n (仅 Settings 可用)             │</Text>
      <Text>│  [Q] 全局退出 (cover: false)               │</Text>
      <Text>└───────────────────────────────────────────┘</Text>
    </Box>
  );
}
registerComponent(Settings, {}, { parent: Menu });

function Game() {
  const { back, skip, overlay: ov } = useScreenSystem();
  const { boundKeyboard, stop } = useKeyboard();

  useEffect(() => {
    const unbindStop = stop(['q']);
    boundKeyboard(['b'], () => back());
    boundKeyboard(['o'], () => ov(PauseOverlay, { msg: 'Game paused' }));
    boundKeyboard(['i'], () => skip(Inventory, {}));
    return () => unbindStop();
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>┌─ Game ───────────────────────────────────┐</Text>
      <Text>│  [B] Back   [I] Inventory   [O] Pause    │</Text>
      <Text>│  [E] 全局 e (未覆盖，冒泡到全局)          │</Text>
      <Text>│  [M] 全局 m (category: *)                 │</Text>
      <Text>│  [Q] stop 阻断                             │</Text>
      <Text>└───────────────────────────────────────────┘</Text>
    </Box>
  );
}
registerComponent(Game, {}, { parent: Menu });

function Inventory() {
  const { back } = useScreenSystem();
  const { boundKeyboard, stop } = useKeyboard();

  useEffect(() => {
    stop(['q']);
    boundKeyboard(['b'], () => back());
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>┌─ Inventory ──────────────────────────────┐</Text>
      <Text>│  [B] Back to Game                         │</Text>
      <Text>│  [U] 全局 u (category: [] 永不触发)       │</Text>
      <Text>└───────────────────────────────────────────┘</Text>
    </Box>
  );
}
registerComponent(Inventory, {}, { parent: Game });

function PauseOverlay({ msg }: { msg: string }) {
  const { closeOverlay } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    boundKeyboard(['escape'], () => closeOverlay());
    boundKeyboard(['x'], () =>
      console.log('[Overlay] x 已被 affectOverlay 全局键抢先'),
    );
  }, []);

  return (
    <Box flexDirection="column" borderStyle="double" padding={1}>
      <Text bold>╔══════════════════════════════════════════╗</Text>
      <Text>║  🔔 {msg.padEnd(36)}║</Text>
      <Text>║  [Esc] Close                             ║</Text>
      <Text>║  [E] 全局 e (affectOverlay: false)       ║</Text>
      <Text>║      在 overlay 之后触发                 ║</Text>
      <Text>║  [X] 全局 x (affectOverlay: true)        ║</Text>
      <Text>║      在 overlay 之前触发                 ║</Text>
      <Text>╚══════════════════════════════════════════╝</Text>
    </Box>
  );
}
registerComponent(PauseOverlay, { msg: '' });

function App() {
  const { globalKeys } = useKeyboard();

  useEffect(() => {
    globalKeys([
      {
        key: 'e',
        operate: () => console.log('[Global] e 键触发'),
        cover: true,
      },
      {
        key: 'q',
        operate: () => process.exit(),
        cover: false,
      },
      {
        key: 'x',
        operate: () => console.log('[Global] x 键触发 (affectOverlay: true)'),
        cover: true,
        affectOverlay: true,
      },
      {
        key: 'n',
        operate: () => console.log('[Global] n 键触发 (仅 Settings)'),
        category: [Settings],
      },
      {
        key: 'm',
        operate: () => console.log('[Global] m 键触发 (全屏 *)'),
        category: '*',
      },
      {
        key: 'u',
        operate: () => console.log('[Global] u 键触发 (永不，category: [])'),
        category: [],
      },
    ]);
  }, []);

  return <CurrentScreen />;
}

render(
  <ScenarioManagementProvider defaultScreen={Menu}>
    <KeyboardProvider>
      <App />
    </KeyboardProvider>
  </ScenarioManagementProvider>,
);