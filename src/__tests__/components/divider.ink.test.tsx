import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Divider } from '../../components/divider/Divider.js';

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

describe('Divider', () => {
  it('渲染默认分隔线（50个 ─）', () => {
    const { lastFrame } = render(React.createElement(Divider));
    expect(stripAnsi(lastFrame())).toBe('─'.repeat(50));
  });

  it('渲染带 label 的分隔线', () => {
    const { lastFrame } = render(React.createElement(Divider, { label: 'OR' }));
    const output = stripAnsi(lastFrame());
    expect(output).toContain(' OR ');
  });

  it('自定义字符', () => {
    const { lastFrame } = render(React.createElement(Divider, { char: '·', width: 10 }));
    expect(stripAnsi(lastFrame())).toBe('·'.repeat(10));
  });
});
