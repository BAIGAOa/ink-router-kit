import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Spinner } from '../../components/spinner/Spinner.js';

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Spinner', () => {
  it('渲染默认帧（第一个字符）', () => {
    const { lastFrame } = render(React.createElement(Spinner));
    expect(stripAnsi(lastFrame())).toBe('⠋');
  });

  it('渲染 label', () => {
    const { lastFrame } = render(React.createElement(Spinner, { label: 'Working...' }));
    expect(stripAnsi(lastFrame())).toContain('Working...');
  });

  it('active=false 时停在第一帧', () => {
    const { lastFrame } = render(React.createElement(Spinner, { active: false }));
    expect(stripAnsi(lastFrame())).toBe('⠋');
  });

  it('渲染指定 type', () => {
    const { lastFrame } = render(React.createElement(Spinner, { type: 'simple' }));
    expect(stripAnsi(lastFrame())).toBe('|');
  });

  it('传入 color 不报错', () => {
    const { lastFrame } = render(React.createElement(Spinner, { color: 'red' }));
    expect(lastFrame()).toBeTruthy();
  });
});
