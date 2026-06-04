import * as fs from 'node:fs';
import * as path from 'node:path';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LanguageFile {
  /** Locale code derived from the file name (e.g. "en-US"). */
  name: string;
  /** Flattened key → template string map. */
  keys: Record<string, string>;
}

export interface MakeLanguageTypeOptions {
  /** Directory containing {locale}.json files. */
  sourceDir: string;
  /** Directory where the generated files will be written. */
  outputDir: string;
  /** Whether to re-generate on file changes. */
  watch: boolean;
  /** Debounce delay in milliseconds (default 500). */
  debounceMs: number;
  /** npm package name to import the original t / useI18n from. */
  packageName: string;
}

/* ------------------------------------------------------------------ */
/*  JSON flattening (must match src/language/provider.tsx)             */
/* ------------------------------------------------------------------ */

/** @internal Exported for testing only. */
export function flatJSON(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[fullKey] = String(value);
    } else if (Array.isArray(value)) {
      result[fullKey] = value.map((v) => String(v)).join(', ');
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flatJSON(value as Record<string, unknown>, fullKey));
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  File scanning                                                     */
/* ------------------------------------------------------------------ */

function scanLanguageFiles(dirPath: string): LanguageFile[] {
  const files: LanguageFile[] = [];

  let entries: string[];
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return files;
  }

  for (const entry of entries.sort()) {
    if (!entry.endsWith('.json')) continue;
    const name = entry.slice(0, -'.json'.length);
    const fullPath = path.resolve(dirPath, entry);
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      files.push({ name, keys: flatJSON(parsed) });
    } catch {
      process.stderr.write(`[ink-kit] Warning: failed to parse "${entry}" — skipped\n`);
    }
  }

  return files;
}

/* ------------------------------------------------------------------ */
/*  Key analysis                                                      */
/* ------------------------------------------------------------------ */

/** Keys present in EVERY language file. */
export function findCommonKeys(files: LanguageFile[]): string[] {
  if (files.length === 0) return [];
  const keySets = files.map((f) => new Set(Object.keys(f.keys)));
  const common = new Set(keySets[0]);
  for (let i = 1; i < keySets.length; i++) {
    for (const key of common) {
      if (!keySets[i].has(key)) common.delete(key);
    }
  }
  return [...common].sort();
}

/** Keys that exist in at least one file but not in all. */
export function findPartialKeys(files: LanguageFile[]): Map<string, string[]> {
  if (files.length === 0) return new Map();
  const allKeys = new Set<string>();
  for (const f of files) for (const k of Object.keys(f.keys)) allKeys.add(k);

  const partial = new Map<string, string[]>();
  for (const key of allKeys) {
    const missing = files.filter((f) => !(key in f.keys)).map((f) => f.name);
    if (missing.length > 0) partial.set(key, missing);
  }
  return partial;
}

/** Extract {param} names from a template string. */
export function extractParams(template: string): string[] {
  const params = new Set<string>();
  const re = /\{(\w+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    params.add(match[1]);
  }
  return [...params].sort();
}

/** Build an array of template strings for a given key across all files. */
export function paramSetsForKey(key: string, files: LanguageFile[]): string[][] {
  return files.map((f) => {
    const template = f.keys[key];
    return template ? extractParams(template) : [];
  });
}

/* ------------------------------------------------------------------ */
/*  Code generation                                                   */
/* ------------------------------------------------------------------ */

/** @internal Exported for testing only. */
export function generateTypesContent(
  commonKeys: string[],
  keyParams: Record<string, string[]>,
): string {
  const lines: string[] = [
    '// Auto-generated by ink-kit makeLanguageType.',
    '// Do not edit manually.',
    '',
    'export type TranslationKey =',
  ];

  if (commonKeys.length === 0) {
    lines.push('  never;');
  } else {
    for (let i = 0; i < commonKeys.length; i++) {
      const delim = i < commonKeys.length - 1 ? '' : ';';
      lines.push(`  | '${escapeSingleQuote(commonKeys[i])}'${delim}`);
    }
  }

  lines.push('');

  if (commonKeys.length === 0) {
    lines.push('export type TranslationParams = Record<string, never>;');
  } else {
    lines.push('export type TranslationParams = {');
    for (const key of commonKeys) {
      const params = keyParams[key];
      if (!params || params.length === 0) {
        lines.push(`  '${escapeSingleQuote(key)}': undefined;`);
      } else {
        const members = params.map((p) => `    ${p}: string | number;`).join('\n');
        lines.push(`  '${escapeSingleQuote(key)}': {\n${members}\n  };`);
      }
    }
    lines.push('};');
  }

  return lines.join('\n') + '\n';
}

/** @internal Exported for testing only. */
export function generateRuntimeContent(packageName: string): string {
  return (
    `// Auto-generated by ink-kit makeLanguageType.\n` +
    `// Do not edit manually.\n` +
    `\n` +
    `import { t as rawT, useI18n as rawUseI18n } from '${escapeSingleQuote(packageName)}';\n` +
    `import type { TranslationKey, TranslationParams } from './i18n-types.js';\n` +
    `\n` +
    `/**\n` +
    ` * Typed translation function. Drop-in replacement for the original \`t\`.\n` +
    ` *\n` +
    ` * @param key - A translation key shared by all language files.\n` +
    ` * @param options - Optional params and/or context.\n` +
    ` */\n` +
    `export function t<K extends TranslationKey>(\n` +
    `  key: K,\n` +
    `  options?: { params?: TranslationParams[K]; context?: string },\n` +
    `): string {\n` +
    `  return rawT(key, options as any);\n` +
    `}\n` +
    `\n` +
    `/**\n` +
    ` * Typed \`useI18n\` hook. Returns the same API as the original hook but\n` +
    ` * with a type-safe \`t\` function.\n` +
    ` */\n` +
    `export function useI18n(): Omit<ReturnType<typeof rawUseI18n>, 't'> & { t: typeof t } {\n` +
    `  const ctx = rawUseI18n();\n` +
    `  return { ...ctx, t: (key: any, options?: any) => ctx.t(key, options) };\n` +
    `}\n`
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** @internal Exported for testing only. */
export function escapeSingleQuote(s: string): string {
  return s.replace(/'/g, "\\'");
}

function writeOutput(outputDir: string, typesContent: string, runtimeContent: string): void {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'i18n-types.d.ts'), typesContent, 'utf-8');
  fs.writeFileSync(path.join(outputDir, 'i18n.ts'), runtimeContent, 'utf-8');
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Generate type-safe i18n bindings from a directory of {locale}.json files.
 *
 * Produces two files in {@link MakeLanguageTypeOptions.outputDir}:
 * - `i18n-types.d.ts` — type declarations (TranslationKey, TranslationParams)
 * - `i18n.ts` — typed `t()` function and `useI18n()` hook
 *
 * In watch mode it re-generates whenever a .json file in sourceDir changes,
 * debounced to avoid rapid rebuilds.
 */
export function makeLanguageType(options: MakeLanguageTypeOptions): void {
  const { sourceDir, outputDir, debounceMs } = options;

  if (!fs.existsSync(sourceDir)) {
    process.stderr.write(`[ink-kit] Error: source directory not found — "${sourceDir}"\n`);
    process.exit(1);
  }

  generate(sourceDir, outputDir, options);

  if (options.watch) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      fs.watch(sourceDir, (_eventType, filename) => {
        if (!filename || !filename.endsWith('.json')) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          process.stderr.write(`[ink-kit] Change detected in "${filename}", regenerating…\n`);
          generate(sourceDir, outputDir, options);
        }, debounceMs);
      });
      process.stderr.write(`[ink-kit] Watching "${sourceDir}" for changes (debounce: ${debounceMs}ms)…\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[ink-kit] Error: watch mode failed — ${msg}\n`);
      process.exit(1);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Core generate function                                            */
/* ------------------------------------------------------------------ */

function generate(sourceDir: string, outputDir: string, options: MakeLanguageTypeOptions): void {
  const files = scanLanguageFiles(sourceDir);

  if (files.length === 0) {
    process.stderr.write(`[ink-kit] Warning: no .json files found in "${sourceDir}"\n`);
    const typesContent = generateTypesContent([], {});
    const runtimeContent = generateRuntimeContent(options.packageName);
    writeOutput(outputDir, typesContent, runtimeContent);
    return;
  }

  // Find partial keys first, emit warnings
  const partialKeys = findPartialKeys(files);
  if (partialKeys.size > 0) {
    for (const [key, missingIn] of partialKeys) {
      process.stderr.write(
        `[ink-kit] Warning: key "${key}" is missing in [${missingIn.join(', ')}] — excluded from type\n`,
      );
    }
  }

  const commonKeys = findCommonKeys(files);

  // Collect params for each common key (union across all files)
  const keyParams: Record<string, string[]> = {};
  for (const key of commonKeys) {
    const allParams = new Set<string>();
    for (const paramsOfFile of paramSetsForKey(key, files)) {
      for (const p of paramsOfFile) allParams.add(p);
    }
    const sorted = [...allParams].sort();
    if (sorted.length > 0) keyParams[key] = sorted;
  }

  const typesContent = generateTypesContent(commonKeys, keyParams);
  const runtimeContent = generateRuntimeContent(options.packageName);
  writeOutput(outputDir, typesContent, runtimeContent);

  process.stderr.write(
    `[ink-kit] Generated ${commonKeys.length} shared keys → ${path.resolve(outputDir)}\n`,
  );
}
