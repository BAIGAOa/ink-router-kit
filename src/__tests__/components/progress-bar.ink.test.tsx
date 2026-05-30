import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { ProgressBar } from '../../components/progress-bar/ProgressBar.js';

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

describe('ProgressBar', () => {
  it('渲染 0%', () => {
    const { lastFrame } = render(React.createElement(ProgressBar, { percent: 0 }));
    const output = stripAnsi(lastFrame());
    expect(output).toContain('0%');
    expect(output).toContain('░');
  });

  it('渲染 100%', () => {
    const { lastFrame } = render(React.createElement(ProgressBar, { percent: 100 }));
    const output = stripAnsi(lastFrame());
    expect(output).toContain('100%');
    expect(output).toContain('█');
    expect(output).not.toContain('░');
  });

  it('渲染 50%', () => {
    const { lastFrame } = render(React.createElement(ProgressBar, { percent: 50 }));
    const output = stripAnsi(lastFrame());
    expect(output).toContain('50%');
    // 20*0.5 = 10 个 █, 10 个 ░
    expect(output).toMatch(/^\[.{20}\]/);
  });

  it('百分比被钳制在 0-100', () => {
    const { lastFrame: l1 } = render(React.createElement(ProgressBar, { percent: -10 }));
    expect(stripAnsi(l1())).toContain('0%');

    const { lastFrame: l2 } = render(React.createElement(ProgressBar, { percent: 150 }));
    expect(stripAnsi(l2())).toContain('100%');
  });

  it('showPercent=false 隐藏百分比', () => {
    const { lastFrame } = render(React.createElement(ProgressBar, { percent: 50, showPercent: false }));
    expect(stripAnsi(lastFrame())).not.toContain('50%');
  });

  it('自定义宽度', () => {
    const { lastFrame } = render(React.createElement(ProgressBar, { percent: 50, width: 10 }));
    const output = stripAnsi(lastFrame());
    // 10*0.5 = 5 个 █, 5 个 ░
    expect(output).toMatch(/^\[.{10}\]/);
  });

  it('自定义颜色不报错', () => {
    const { lastFrame } = render(React.createElement(ProgressBar, { percent: 50, color: 'green' }));
    expect(lastFrame()).toBeTruthy();
  });
});
