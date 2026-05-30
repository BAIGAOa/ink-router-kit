import React from 'react';
import { render, Box, Text } from 'ink';
import { Divider } from '../../components/divider/Divider.js';

function Demo() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>Divider 组件演示</Text>
      <Box flexDirection="column" marginTop={1} gap={1}>
        <Text>默认分隔线:</Text>
        <Divider />
        <Divider />
        <Text>带文字:</Text>
        <Divider label="OR" />
        <Text>自定义字符:</Text>
        <Divider char="·" />
        <Text>自定义宽度:</Text>
        <Divider width={20} />
        <Text>带文字 + 自定义字符:</Text>
        <Divider label="END" char="═" />
      </Box>
    </Box>
  );
}

render(React.createElement(Demo));
