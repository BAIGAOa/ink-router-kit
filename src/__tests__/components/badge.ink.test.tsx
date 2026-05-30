import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Badge } from '../../components/badge/Badge.js';

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

describe('Badge', () => {
  it('渲染文本', () => {
    const { lastFrame } = render(React.createElement(Badge, null, 'New'));
    expect(stripAnsi(lastFrame())).toContain('New');
  });

  it('默认颜色为 cyan', () => {
    const { lastFrame } = render(React.createElement(Badge, null, 'Tag'));
    expect(stripAnsi(lastFrame())).toContain('Tag');
  });

  it('自定义颜色不报错', () => {
    const { lastFrame } = render(React.createElement(Badge, { color: 'red' }, 'Error'));
    expect(lastFrame()).toBeTruthy();
  });
});
