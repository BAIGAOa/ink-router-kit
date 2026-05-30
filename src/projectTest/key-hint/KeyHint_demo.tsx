import React from 'react';
import { render, Box, Text } from 'ink';
import { KeyHint } from '../../components/key-hint/KeyHint.js';
import { Divider } from '../../components/divider/Divider.js';

function Demo() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>KeyHint 组件演示</Text>
      <Box flexDirection="column" marginTop={1} gap={1}>
        <Text>菜单快捷键:</Text>
        <KeyHint keys={[
          { key: 's', desc: 'Start' },
          { key: 'l', desc: 'Load' },
          { key: 'q', desc: 'Quit' },
        ]} />
        <Divider />
        <Text>编辑快捷键:</Text>
        <KeyHint keys={[
          { key: 'ctrl+s', desc: 'Save' },
          { key: 'ctrl+z', desc: 'Undo' },
          { key: 'ctrl+c', desc: 'Copy' },
          { key: 'ctrl+v', desc: 'Paste' },
        ]} />
        <Divider />
        <Text>单个键:</Text>
        <KeyHint keys={[
          { key: '?', desc: 'Help' },
        ]} />
      </Box>
    </Box>
  );
}

render(React.createElement(Demo));
