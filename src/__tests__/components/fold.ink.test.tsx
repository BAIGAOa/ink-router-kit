import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Text } from 'ink';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { CurrentScreen } from '../../screen/current-screen.js';
import { KeyboardProvider } from '../../keyboard/provider.js';
import { Fold } from '../../components/fold/Fold.js';
import type { StorageAPI } from '../../storage/index.js';

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

async function flush() { await new Promise(r => setTimeout(r, 10)); }

function renderFold(props?: { expanded?: boolean; onToggle?: () => void; preview?: React.ReactNode; storage?: StorageAPI; storageKey?: string }) {
  function Host() {
    return React.createElement(Fold, {
      focusId: 'fold',
      label: 'Settings',
      expanded: props?.expanded,
      onToggle: props?.onToggle,
      preview: props?.preview,
      storage: props?.storage,
      storageKey: props?.storageKey,
    }, React.createElement(Text, null, 'Hidden content'));
  }

  clearRegistry();
  registerComponent(Host, {});
  const { lastFrame, stdin, unmount } = render(
    React.createElement(ScenarioManagementProvider, { defaultScreen: Host },
      React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
    ),
  );
  return { lastFrame, lastFrameClear: () => stripAnsi(lastFrame()), stdin, unmount };
}

beforeEach(() => clearRegistry());
afterEach(() => vi.restoreAllMocks());

describe('Fold', () => {
  it('折叠状态显示 preview，不显示 children', () => {
    const { lastFrameClear } = renderFold({ preview: React.createElement(Text, null, 'Preview text') });
    expect(lastFrameClear()).toContain('Settings');
    expect(lastFrameClear()).toContain('Preview text');
    expect(lastFrameClear()).not.toContain('Hidden content');
  });

  it('折叠状态显示 label，不显示 children', () => {
    const { lastFrameClear } = renderFold();
    expect(lastFrameClear()).toContain('Settings');
    expect(lastFrameClear()).not.toContain('Hidden content');
  });

  it('展开状态显示 children', () => {
    const { lastFrameClear } = renderFold({ expanded: true });
    expect(lastFrameClear()).toContain('Settings');
    expect(lastFrameClear()).toContain('Hidden content');
  });

  it('Space 切换折叠/展开', async () => {
    let expanded = false;
    const { stdin, lastFrameClear } = renderFold({
      expanded,
      onToggle: () => { expanded = !expanded; },
    });
    expect(lastFrameClear()).not.toContain('Hidden content');

    // 模拟 Space + 重新渲染（受控模式下 onToggle 不触发内部状态）
    stdin.write(' ');
    await new Promise(r => setTimeout(r, 10));

    // 受控模式：onToggle 被调用，但父组件需要更新 expanded prop
    expect(expanded).toBe(true);
  });

  it('非受控模式 defaultExpanded=true 初始展开', () => {
    function Host() {
      return React.createElement(Fold, {
        focusId: 'fold',
        label: 'Test',
        defaultExpanded: true,
      }, React.createElement(Text, null, 'Content inside'));
    }

    clearRegistry();
    registerComponent(Host, {});
    const { lastFrame } = render(
      React.createElement(ScenarioManagementProvider, { defaultScreen: Host },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );
    const output = stripAnsi(lastFrame());
    expect(output).toContain('Content inside');
  });
});

describe('Fold 持久化', () => {
  function makeMockStorage() {
    const store: Record<string, unknown> = {};
    return {
      store,
      api: {
        write: {
          num: vi.fn(async () => {}),
          str: vi.fn(async () => {}),
          b: vi.fn(async (_k: string, v: boolean) => { store[_k] = v; }),
          obj: vi.fn(async () => {}),
          arr: vi.fn(async () => {}),
          any: vi.fn(async () => {}),
        },
        read: {
          num: vi.fn(async () => 0),
          str: vi.fn(async () => ''),
          b: vi.fn(async (k: string, def: boolean) => (store[k] as boolean) ?? def),
          obj: vi.fn(async () => ({})),
          arr: vi.fn(async () => []),
          any: vi.fn(async () => undefined),
        },
        has: vi.fn(async () => false),
        delete: vi.fn(async () => {}),
        clear: vi.fn(async () => {}),
        getAll: vi.fn(async () => ({})),
      } as StorageAPI,
    };
  }

  it('传入 storage 时，展开/折叠后写入 storage', async () => {
    const { api } = makeMockStorage();

    function Host() {
      return React.createElement(Fold, {
        focusId: 'pf',
        label: 'Test',
        storage: api,
      }, React.createElement(Text, null, 'Inside'));
    }
    clearRegistry();
    registerComponent(Host, {});
    const { stdin } = render(
      React.createElement(ScenarioManagementProvider, { defaultScreen: Host },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );
    await flush();

    stdin.write(' ');
    await flush();

    expect((api.write.b as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('fold:pf', true);
  });

  it('传入 storageKey 时使用自定义键名', async () => {
    const { api } = makeMockStorage();

    function Host() {
      return React.createElement(Fold, {
        focusId: 'pf',
        label: 'Test',
        storage: api,
        storageKey: 'custom-fold-key',
      }, React.createElement(Text, null, 'Inside'));
    }
    clearRegistry();
    registerComponent(Host, {});
    render(
      React.createElement(ScenarioManagementProvider, { defaultScreen: Host },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );
    await flush();

    expect((api.read.b as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('custom-fold-key', false);
  });

  it('不传 storage 时不影响现有行为', async () => {
    function Host() {
      return React.createElement(Fold, {
        focusId: 'pf',
        label: 'Test',
      }, React.createElement(Text, null, 'Inside'));
    }
    clearRegistry();
    registerComponent(Host, {});
    const { lastFrame } = render(
      React.createElement(ScenarioManagementProvider, { defaultScreen: Host },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );
    await flush();
    expect(stripAnsi(lastFrame())).toContain('Test');
    expect(stripAnsi(lastFrame())).not.toContain('Inside');
  });
});
