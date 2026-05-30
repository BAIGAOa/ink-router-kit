import React from 'react';
import { render, Box, Text } from 'ink';
import { Spinner } from '../../components/spinner/Spinner.js';
import { Divider } from '../../components/divider/Divider.js';

function Demo() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>Spinner 组件演示</Text>
      <Box flexDirection="column" marginTop={1} gap={1}>
        <Box>
          <Text>默认: </Text>
          <Spinner />
        </Box>
        <Box>
          <Text>带文字: </Text>
          <Spinner label="Loading..." />
        </Box>
        <Box>
          <Text>颜色: </Text>
          <Spinner color="green" label="Processing" />
        </Box>
        <Divider label="动画风格" />
        <Box>
          <Text>simple: </Text>
          <Spinner type="simple" />
        </Box>
        <Box>
          <Text>line: </Text>
          <Spinner type="line" />
        </Box>
        <Box>
          <Text>triangle: </Text>
          <Spinner type="triangle" />
        </Box>
        <Box>
          <Text>arc: </Text>
          <Spinner type="arc" />
        </Box>
        <Divider label="状态" />
        <Box>
          <Text>active=false: </Text>
          <Spinner active={false} label="Done!" color="green" />
        </Box>
      </Box>
    </Box>
  );
}

render(React.createElement(Demo));
