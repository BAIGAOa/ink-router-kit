import React from 'react';
import { render, Box, Text } from 'ink';
import { Badge } from '../../components/badge/Badge.js';

function Demo() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>Badge 组件演示</Text>
      <Box flexDirection="column" marginTop={1} gap={1}>
        <Box>
          <Text>默认（cyan）:</Text>
          <Badge>New</Badge>
        </Box>
        <Box>
          <Text>绿色:</Text>
          <Badge color="green">Success</Badge>
        </Box>
        <Box>
          <Text>红色:</Text>
          <Badge color="red">Error</Badge>
        </Box>
        <Box>
          <Text>黄色:</Text>
          <Badge color="yellow">Warning</Badge>
        </Box>
        <Box>
          <Text>蓝色:</Text>
          <Badge color="blue">Info</Badge>
        </Box>
        <Box>
          <Text>多个:</Text>
          <Badge color="green">Build</Badge>
          <Badge color="yellow">Test</Badge>
          <Badge color="red">Lint</Badge>
        </Box>
      </Box>
    </Box>
  );
}

render(React.createElement(Demo));
