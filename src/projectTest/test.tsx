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

// ══ 注册 ══

function Menu() {
  const { skip } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['s'], () => skip(Game, {}));
    boundKeyboard(['q'], () => skip(QuitConfirm, {}));
  }, []);
  return (
    <Box flexDirection="column">
      <Text>主菜单</Text>
      <Text>[S] 开始游戏  [Q] 退出</Text>
    </Box>
  );
}
registerComponent(Menu, {});

function Game() {
  const { back, skip, overlay: ov } = useScreenSystem();
  const { boundKeyboard, stop } = useKeyboard();
  useEffect(() => {
    const unbindStop = stop(['q']);       // 阻断 q 冒泡到 Menu
    boundKeyboard(['b'], () => back());
    boundKeyboard(['o'], () => ov(Notice, { msg: '暂停中' }));
    boundKeyboard(['i'], () => skip(Inventory, {}));
    return () => unbindStop();
  }, []);
  return (
    <Box flexDirection="column">
      <Text>游戏中（q 键已阻断，不会误退出）</Text>
      <Text>[B] 返回  [I] 背包  [O] 暂停浮层</Text>
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
    <Box flexDirection="column">
      <Text>背包（q 键阻断）</Text>
      <Text>[B] 返回</Text>
    </Box>
  );
}
registerComponent(Inventory, {}, { parent: Game });

function Notice({ msg }: { msg: string }) {
  const { closeOverlay } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();
  useEffect(() => {
    boundKeyboard(['escape'], () => closeOverlay());
  }, []);
  return (
    <Box flexDirection="column" borderStyle="single">
      <Text>🔔 {msg}</Text>
      <Text>按 Esc 关闭</Text>
    </Box>
  );
}
registerComponent(Notice, { msg: '' });

function QuitConfirm() {
  return (
    <Box flexDirection="column">
      <Text>真的要退出吗？（此处仅示意，按 B 回菜单）</Text>
      <Text>[B] 返回</Text>
    </Box>
  );
}
registerComponent(QuitConfirm, {}, { parent: Menu });

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
