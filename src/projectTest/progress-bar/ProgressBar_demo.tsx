import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { ProgressBar } from '../../components/progress-bar/ProgressBar.js';
import { Divider } from '../../components/divider/Divider.js';

function Demo() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPct((p) => (p >= 100 ? 0 : p + 2));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>ProgressBar 组件演示</Text>
      <Box flexDirection="column" marginTop={1} gap={1}>
        <Box>
          <Text>默认: </Text>
          <ProgressBar percent={pct} />
        </Box>
        <Box>
          <Text>绿色: </Text>
          <ProgressBar percent={pct} color="green" />
        </Box>
        <Box>
          <Text>宽 40: </Text>
          <ProgressBar percent={pct} width={40} />
        </Box>
        <Box>
          <Text>无百分比: </Text>
          <ProgressBar percent={pct} showPercent={false} />
        </Box>
        <Box>
          <Text>自定义字符: </Text>
          <ProgressBar percent={pct} char="■" emptyChar="·" />
        </Box>
        <Divider />
        <Box>
          <Text>固定 50%: </Text>
          <ProgressBar percent={50} />
        </Box>
        <Box>
          <Text>固定 0%: </Text>
          <ProgressBar percent={0} />
        </Box>
        <Box>
          <Text>固定 100%: </Text>
          <ProgressBar percent={100} />
        </Box>
      </Box>
    </Box>
  );
}

render(React.createElement(Demo));
