import React from "react";
import type { RegisterOptions } from "./types.js";

/** 单条注册记录 */
interface RegistryEntry {
  /** 参数模板对象 */
  template: Record<string, unknown>;
  /** 父节点组件引用（null 表示根节点候选） */
  parent: React.ComponentType<any> | null;
  /** 子节点列表（由 registerComponent 自动维护） */
  children: Set<React.ComponentType<any>>;
}

/** 模块级注册表：组件 → 注册信息 */
const registry = new Map<React.ComponentType<any>, RegistryEntry>();

/**
 * Register a component as a screen in the navigation tree.
 *
 * @param component  The React component (used as the unique token).
 * @param template   Default props for the component.
 * @param options    Optional registration options (e.g. `parent` to attach
 *                   the component under an existing node in the tree).
 *
 * @throws If the component has already been registered.
 */
export function registerComponent<C extends React.ComponentType<any>>(
  component: C,
  template: React.ComponentProps<C>,
  options?: RegisterOptions,
): void {
  if (registry.has(component)) {
    throw new Error(
      `[Ink-Trc] 组件 "${component.displayName || component.name || "anonymous"}" 已注册，不能重复注册。`,
    );
  }

  registry.set(component, {
    template: template as Record<string, unknown>,
    parent: options?.parent ?? null,
    children: new Set(),
  });

  // 如果声明了父节点，将自己添加到父节点的 children 中
  if (options?.parent) {
    const parentEntry = registry.get(options.parent);
    if (parentEntry) {
      parentEntry.children.add(component);
    }
  }
}

/** 获取组件的模板参数 */
export function getTemplate(
  component: React.ComponentType<any>,
): Record<string, unknown> | undefined {
  return registry.get(component)?.template;
}

/** 获取组件的父节点 */
export function getParent(
  component: React.ComponentType<any>,
): React.ComponentType<any> | null | undefined {
  return registry.get(component)?.parent;
}

/** 获取组件的子节点列表 */
export function getChildren(
  component: React.ComponentType<any>,
): React.ComponentType<any>[] {
  const entry = registry.get(component);
  return entry ? Array.from(entry.children) : [];
}

/** 检查组件是否已注册 */
export function hasComponent(component: React.ComponentType<any>): boolean {
  return registry.has(component);
}

/** 获取所有根节点（parent 为 null 的组件） */
export function getRoots(): React.ComponentType<any>[] {
  const roots: React.ComponentType<any>[] = [];
  for (const [component, entry] of registry) {
    if (entry.parent === null) {
      roots.push(component);
    }
  }
  return roots;
}

/** 判断 child 是否是 parent 的直接子节点 */
export function isChildOf(
  child: React.ComponentType<any>,
  parent: React.ComponentType<any>,
): boolean {
  const entry = registry.get(child);
  return entry?.parent === parent;
}

/** 清除所有注册（仅供测试使用） */
export function clearRegistry(): void {
  registry.clear();
}
