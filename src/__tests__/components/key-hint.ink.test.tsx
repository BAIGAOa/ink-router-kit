import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { KeyHint } from '../../components/key-hint/KeyHint.js';

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

describe('KeyHint', () => {
  it('渲染所有快捷键提示', () => {
    const { lastFrame } = render(React.createElement(KeyHint, {
      keys: [
        { key: 's', desc: 'Save' },
        { key: 'q', desc: 'Quit' },
      ],
    }));
    const output = stripAnsi(lastFrame());
    expect(output).toContain('[s]');
    expect(output).toContain('Save');
    expect(output).toContain('[q]');
    expect(output).toContain('Quit');
  });

  it('单个键也正常渲染', () => {
    const { lastFrame } = render(React.createElement(KeyHint, {
      keys: [{ key: '?', desc: 'Help' }],
    }));
    const output = stripAnsi(lastFrame());
    expect(output).toContain('[?]');
    expect(output).toContain('Help');
  });
});
