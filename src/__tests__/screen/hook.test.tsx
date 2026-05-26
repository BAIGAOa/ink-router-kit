import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { ScreenSystemContext, ScreenSystemContextValue } from '../../screen/context';
import { useScreenSystem } from '../../screen/hook';

function TestConsumer({ onValue }: { onValue: (v: ScreenSystemContextValue) => void }) {
  const value = useScreenSystem();
  onValue(value);
  return React.createElement('text', null, 'consumer');
}

describe('useScreenSystem', () => {
  it('在 Provider 内部可以正常获取 context 值', () => {
    let captured: ScreenSystemContextValue | undefined;

    const mockValue: ScreenSystemContextValue = {
      currentScreen: React.createElement('text', null, 'hello'),
      skip: () => {},
    };

    render(
      React.createElement(
        ScreenSystemContext.Provider,
        { value: mockValue },
        React.createElement(TestConsumer, {
          onValue: (v: ScreenSystemContextValue) => {
            captured = v;
          },
        }),
      ),
    );

    expect(captured).toBe(mockValue);
    expect(captured?.currentScreen).toBe(mockValue.currentScreen);
  });

  it('在 Provider 外部调用会抛错', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(React.createElement(TestConsumer, { onValue: () => {} }));
    }).toThrow('[Ink-Router-Kit] useScreenSystem()');

    consoleError.mockRestore();
  });
});