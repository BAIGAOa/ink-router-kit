import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import {
  registerComponent,
  getTemplate,
  hasComponent,
  getParent,
  getChildren,
  isChildOf,
  getRoots,
  clearRegistry,
} from '../../screen/registry.js';

// ── 测试用组件 ────────────────────────────────────────────

function Menu({}: {}) {
  return React.createElement('div', null, 'Menu');
}
Menu.displayName = 'Menu';

function Settings({ theme }: { theme: string }) {
  return React.createElement('div', null, theme);
}
Settings.displayName = 'Settings';

function GameLevel({ level }: { level: number }) {
  return React.createElement('div', null, String(level));
}
GameLevel.displayName = 'GameLevel';

function Combat({ enemy }: { enemy: string }) {
  return React.createElement('div', null, enemy);
}
Combat.displayName = 'Combat';

function Inventory({ items }: { items: string[] }) {
  return React.createElement('div', null, String(items.length));
}
Inventory.displayName = 'Inventory';

// ── Setup ─────────────────────────────────────────────────

beforeEach(() => {
  clearRegistry();
});

// ── 基础注册 ──────────────────────────────────────────────

describe('registerComponent（基础）', () => {
  it('注册后 hasComponent 返回 true', () => {
    registerComponent(Menu, {});
    expect(hasComponent(Menu)).toBe(true);
  });

  it('注册后 getTemplate 返回模板参数', () => {
    registerComponent(Settings, { theme: 'dark' });
    expect(getTemplate(Settings)).toEqual({ theme: 'dark' });
  });

  it('重复注册抛错', () => {
    registerComponent(Menu, {});
    expect(() => registerComponent(Menu, {})).toThrow('is already registered');
  });

  it('多个组件可分别注册', () => {
    registerComponent(Menu, {});
    registerComponent(Settings, { theme: 'dark' });
    expect(hasComponent(Menu)).toBe(true);
    expect(hasComponent(Settings)).toBe(true);
  });

  it('未注册组件 hasComponent 返回 false', () => {
    expect(hasComponent(Combat)).toBe(false);
  });

  it('未注册组件 getTemplate 返回 undefined', () => {
    expect(getTemplate(Combat)).toBeUndefined();
  });
});

// ── 树结构 ────────────────────────────────────────────────

describe('registerComponent（树结构）', () => {
  it('未传 parent 时为根节点', () => {
    registerComponent(Menu, {});
    expect(getParent(Menu)).toBeNull();
    expect(getRoots()).toContain(Menu);
  });

  it('注册时声明 parent 建立父子关系', () => {
    registerComponent(Menu, {});
    registerComponent(Settings, { theme: 'dark' }, { parent: Menu });
    expect(getParent(Settings)).toBe(Menu);
  });

  it('getChildren 返回所有子节点', () => {
    registerComponent(Menu, {});
    registerComponent(Settings, { theme: 'dark' }, { parent: Menu });
    registerComponent(GameLevel, { level: 1 }, { parent: Menu });
    const children = getChildren(Menu);
    expect(children).toContain(Settings);
    expect(children).toContain(GameLevel);
    expect(children).toHaveLength(2);
  });

  it('isChildOf 正确判断父子关系', () => {
    registerComponent(Menu, {});
    registerComponent(GameLevel, { level: 1 }, { parent: Menu });
    registerComponent(Combat, { enemy: 'goblin' }, { parent: GameLevel });

    expect(isChildOf(GameLevel, Menu)).toBe(true);
    expect(isChildOf(Combat, GameLevel)).toBe(true);
    expect(isChildOf(Combat, Menu)).toBe(false);
    expect(isChildOf(Settings, Menu)).toBe(false);
  });

  it('多层嵌套树结构正确', () => {
    // Menu → GameLevel → Combat
    registerComponent(Menu, {});
    registerComponent(GameLevel, { level: 1 }, { parent: Menu });
    registerComponent(Combat, { enemy: 'goblin' }, { parent: GameLevel });
    registerComponent(Inventory, { items: [] }, { parent: GameLevel });

    expect(getParent(Menu)).toBeNull();
    expect(getParent(GameLevel)).toBe(Menu);
    expect(getParent(Combat)).toBe(GameLevel);
    expect(getParent(Inventory)).toBe(GameLevel);

    const menuChildren = getChildren(Menu);
    expect(menuChildren).toHaveLength(1);
    expect(menuChildren).toContain(GameLevel);

    const gameChildren = getChildren(GameLevel);
    expect(gameChildren).toHaveLength(2);
    expect(gameChildren).toContain(Combat);
    expect(gameChildren).toContain(Inventory);

    expect(getChildren(Combat)).toHaveLength(0);
  });

  it('getRoots 返回所有根节点', () => {
    registerComponent(Menu, {});
    // 另一个不在树中的独立根节点
    function Standalone({}: {}) {
      return React.createElement('div', null);
    }
    Standalone.displayName = 'Standalone';
    registerComponent(Standalone, {});

    const roots = getRoots();
    expect(roots).toHaveLength(2);
    expect(roots).toContain(Menu);
    expect(roots).toContain(Standalone);
  });
});