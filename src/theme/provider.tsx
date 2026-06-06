import React, { useState, useMemo, useCallback } from 'react';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { ThemeContext } from './context.js';
import type { ThemeDefinition, ThemeContextValue } from './types.js';

export interface ThemeProviderProps {
  children: React.ReactNode;
  themes?: ThemeDefinition[];
  path?: string;
  defaultTheme?: string;
}

/**
 * Extract unique non-id keys from a list of themes.
 * All themes must have identical keys after removing 'id'.
 */
function extractKeys(themes: ThemeDefinition[]): string[] {
  if (themes.length === 0) return [];
  const first = themes[0];
  const keys = Object.keys(first).filter((k) => k !== 'id');

  for (let i = 1; i < themes.length; i++) {
    const current = Object.keys(themes[i]).filter((k) => k !== 'id');
    const missing = keys.filter((k) => !current.includes(k));
    const extra = current.filter((k) => !keys.includes(k));
    if (missing.length > 0 || extra.length > 0) {
      const details: string[] = [];
      if (missing.length > 0) details.push(`missing from "${themes[i].id}": ${missing.join(', ')}`);
      if (extra.length > 0) details.push(`extra in "${themes[i].id}": ${extra.join(', ')}`);
      throw new Error(
        `[Ink-Router-Kit] Theme key mismatch in "${themes[i].id}". ` +
        `All themes must have identical keys (excluding 'id'). ${details.join('; ')}`,
      );
    }
  }

  return keys;
}

function loadFromPath(dirPath: string): ThemeDefinition[] {
  const themes: ThemeDefinition[] = [];
  let files: string[];
  try {
    files = readdirSync(dirPath);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[Ink-Router-Kit] ThemeProvider failed to read directory "${dirPath}": ${msg}`,
    );
  }
  for (const file of files) {
    if (file.endsWith('.json')) {
      const fullPath = resolve(dirPath, file);
      let raw: string;
      try {
        raw = readFileSync(fullPath, 'utf-8');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `[Ink-Router-Kit] ThemeProvider failed to read "${fullPath}": ${msg}`,
        );
      }
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (typeof parsed.id !== 'string') {
          throw new Error(
            `[Ink-Router-Kit] Theme file "${file}" is missing a required "id" field (string).`,
          );
        }
        // Build a ThemeDefinition: strip the id field from the flat map
        const theme: ThemeDefinition = { id: parsed.id };
        for (const [k, v] of Object.entries(parsed)) {
          if (k === 'id') continue;
          if (typeof v === 'string' || typeof v === 'boolean') {
            theme[k] = v;
          }
        }
        themes.push(theme);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `[Ink-Router-Kit] ThemeProvider failed to parse "${file}": ${msg}`,
        );
      }
    }
  }
  return themes;
}

/**
 * Load themes from multiple directory paths with filename-based deduplication.
 *
 * Processes paths in order — later paths override earlier ones when the
 * same filename appears in multiple directories (within the batch).
 *
 * Returns the deduplicated list of ThemeDefinitions.
 */
function loadFromPaths(paths: string[]): ThemeDefinition[] {
  // Map: filename → ThemeDefinition. Same filename → later overwrites earlier.
  const fileMap = new Map<string, ThemeDefinition>();

  for (const dirPath of paths) {
    let files: string[];
    try {
      files = readdirSync(dirPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[Ink-Router-Kit] ThemeProvider failed to read directory "${dirPath}": ${msg}`,
      );
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const fullPath = resolve(dirPath, file);
      let raw: string;
      try {
        raw = readFileSync(fullPath, 'utf-8');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `[Ink-Router-Kit] ThemeProvider failed to read "${fullPath}": ${msg}`,
        );
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `[Ink-Router-Kit] ThemeProvider failed to parse "${file}": ${msg}`,
        );
      }

      if (typeof parsed.id !== 'string') {
        throw new Error(
          `[Ink-Router-Kit] Theme file "${file}" is missing a required "id" field (string).`,
        );
      }

      const theme: ThemeDefinition = { id: parsed.id };
      for (const [k, v] of Object.entries(parsed)) {
        if (k === 'id') continue;
        if (typeof v === 'string' || typeof v === 'boolean') {
          theme[k] = v;
        }
      }

      // Filename dedup: later paths win for same filename
      fileMap.set(file, theme);
    }
  }

  return Array.from(fileMap.values());
}

/**
 * Context provider for theming.
 *
 * Loads theme definitions either from a directory of `{id}.json` files
 * (via the `path` prop) or from pre-built inline objects (via `themes`).
 *
 * Descendant components can use the {@link useTheme} hook to access
 * `color()` and `style()` functions, and `setTheme()` to switch themes.
 */
export function ThemeProvider({
  children,
  themes: inlineThemes = [],
  path,
  defaultTheme,
}: ThemeProviderProps) {
  const rawThemes = useMemo(() => {
    if (path) return loadFromPath(path);
    return inlineThemes;
  }, [inlineThemes, path]);

  // Overlay state for mergeTheme — avoids mutating rawThemes
  const [mergedThemes, setMergedThemes] = useState<ThemeDefinition[] | null>(null);
  const effectiveThemes = mergedThemes ?? rawThemes;

  // Validate key consistency — only on initial load; merged themes are
  // validated separately at merge time
  if (rawThemes.length > 0) {
    extractKeys(rawThemes);
  }

  const themeIds = useMemo(() => effectiveThemes.map((t) => t.id), [effectiveThemes]);
  const [currentThemeId, setCurrentThemeId] = useState<string>(
    defaultTheme ?? themeIds[0] ?? '',
  );

  const currentTheme = useMemo(
    () => effectiveThemes.find((t) => t.id === currentThemeId),
    [effectiveThemes, currentThemeId],
  );

  const color = useCallback(
    (key: string): string | undefined => {
      if (!currentTheme) return undefined;
      const val = currentTheme[key];
      if (typeof val === 'string') return val;
      return undefined;
    },
    [currentTheme],
  );

  const style = useCallback(
    (key: string): boolean | undefined => {
      if (!currentTheme) return undefined;
      const val = currentTheme[key];
      if (typeof val === 'boolean') return val;
      return undefined;
    },
    [currentTheme],
  );

  const setTheme = useCallback(
    (id: string) => {
      if (!effectiveThemes.find((t) => t.id === id)) {
        const available = themeIds.join(', ');
        throw new Error(
          `[Ink-Router-Kit] Theme "${id}" is not available. ` +
          `Available themes: ${available}`,
        );
      }
      setCurrentThemeId(id);
    },
    [effectiveThemes, themeIds],
  );

  const mergeTheme = useCallback(
    (paths: string[]) => {
      const base = mergedThemes ?? rawThemes;
      // Build a lookup of existing themes by id
      const lookup = new Map<string, ThemeDefinition>();
      for (const t of base) {
        const copy: ThemeDefinition = { id: t.id };
        for (const [k, v] of Object.entries(t)) {
          if (k !== 'id') copy[k] = v;
        }
        lookup.set(t.id, copy);
      }

      let hadChanges = false;
      for (const dirPath of paths) {
        const incoming = loadFromPath(dirPath);
        for (const inc of incoming) {
          const existing = lookup.get(inc.id);
          if (!existing) continue; // ignore themes not in base
          for (const [k, v] of Object.entries(inc)) {
            if (k === 'id') continue;
            existing[k] = v;
          }
          hadChanges = true;
        }
      }

      if (hadChanges) {
        const merged = Array.from(lookup.values());
        extractKeys(merged); // re-validate after merge
        setMergedThemes(merged);
      }
    },
    [mergedThemes, rawThemes],
  );

  // ── addThemes ────────────────────────────────────────────────
  const addThemes = useCallback(
    (paths: string[]) => {
      const base = mergedThemes ?? rawThemes;
      const existingIds = new Set(base.map((t) => t.id));

      // Load from all paths with filename-based dedup
      const incoming = loadFromPaths(paths);

      // Detect id conflicts within the incoming batch (different filenames
      // claiming the same id — filename dedup already resolved same-file cases).
      // Re-scan all files to build a mapping of id → [source filenames],
      // then flag any id claimed by more than one filename.
      const idSourceFiles = new Map<string, string[]>(); // id → [filenames]
      for (const dirPath of paths) {
        let files: string[];
        try {
          files = readdirSync(dirPath);
        } catch {
          continue; // loadFromPaths already validates, should not reach here
        }
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          const fullPath = resolve(dirPath, file);
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(readFileSync(fullPath, 'utf-8')) as Record<string, unknown>;
          } catch {
            continue;
          }
          if (typeof parsed.id !== 'string') continue;
          if (!idSourceFiles.has(parsed.id)) {
            idSourceFiles.set(parsed.id, []);
          }
          const list = idSourceFiles.get(parsed.id)!;
          if (!list.includes(file)) {
            list.push(file);
          }
        }
      }

      // Check: same id claimed by multiple filenames → error
      for (const [id, filenames] of idSourceFiles) {
        if (filenames.length > 1) {
          throw new Error(
            `[Ink-Router-Kit] addThemes detected duplicate theme id "${id}" ` +
            `in files: ${filenames.join(', ')}. Theme ids must be unique.`,
          );
        }
      }

      // Expected key set from existing themes
      const expectedKeys =
        base.length > 0
          ? Object.keys(base[0]).filter((k) => k !== 'id')
          : [];

      // Validate each incoming theme
      for (const theme of incoming) {
        // Id conflict with base → error
        if (existingIds.has(theme.id)) {
          throw new Error(
            `[Ink-Router-Kit] addThemes cannot add theme "${theme.id}" ` +
            `because a theme with this id already exists. ` +
            `Use mergeTheme() to update existing themes.`,
          );
        }

        // Only validate keys if we have a reference set
        if (expectedKeys.length > 0) {
          const incKeys = Object.keys(theme).filter((k) => k !== 'id');
          const missing = expectedKeys.filter((k) => !incKeys.includes(k));
          const extra = incKeys.filter((k) => !expectedKeys.includes(k));

          const details: string[] = [];
          if (missing.length > 0) details.push(`missing: ${missing.join(', ')}`);
          if (extra.length > 0) details.push(`extra: ${extra.join(', ')}`);

          if (details.length > 0) {
            throw new Error(
              `[Ink-Router-Kit] addThemes theme "${theme.id}" has mismatched keys. ` +
              `All themes must have identical keys (excluding 'id'). ${details.join('; ')}`,
            );
          }
        }

        existingIds.add(theme.id);
      }

      if (incoming.length > 0) {
        const combined = [...base, ...incoming];
        extractKeys(combined); // final safety check
        setMergedThemes(combined);
      }
    },
    [mergedThemes, rawThemes],
  );

  const ctx: ThemeContextValue = useMemo(
    () => ({
      color,
      style,
      themeId: currentThemeId,
      themes: themeIds,
      setTheme,
      mergeTheme,
      addThemes,
    }),
    [color, style, currentThemeId, themeIds, setTheme, mergeTheme, addThemes],
  );

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}
