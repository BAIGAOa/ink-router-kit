import React, { ReactNode, useState, useMemo, useCallback } from 'react';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { LanguageContext } from './context.js';
import type { I18nContextValue } from './types.js';

function loadFromPath(dirPath: string): Record<string, Record<string, string>> {
  const resources: Record<string, Record<string, string>> = {};
  const files = readdirSync(dirPath);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const lang = file.replace('.json', '');
      const raw = readFileSync(resolve(dirPath, file), 'utf-8');
      resources[lang] = flatJSON(JSON.parse(raw));
    }
  }
  return resources;
}

function flatJSON(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flatJSON(value as Record<string, unknown>, fullKey));
    }
  }
  return result;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

interface LanguageProviderProps {
  children: ReactNode;
  resources?: Record<string, Record<string, string>>;
  path?: string;
  defaultLanguage?: string;
  fallbackLanguage?: string;
}

export function LanguageProvider({
  children,
  resources: inlineResources,
  path,
  defaultLanguage,
  fallbackLanguage,
}: LanguageProviderProps) {
  const rawResources = useMemo(() => {
    if (inlineResources) return inlineResources;
    if (path) return loadFromPath(path);
    return {};
  }, [inlineResources, path]);

  const languages = useMemo(() => Object.keys(rawResources), [rawResources]);

  const [lang, setLang] = useState<string>(
    defaultLanguage ?? languages[0] ?? 'en-US',
  );

  const currentResources = rawResources[lang] ?? {};

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = currentResources[key];

      if (value === undefined && fallbackLanguage) {
        const fb = rawResources[fallbackLanguage];
        if (fb) value = fb[key];
      }

      if (value === undefined) return key;
      return interpolate(value, params);
    },
    [currentResources, rawResources, fallbackLanguage],
  );

  const setLanguage = useCallback(
    (newLang: string) => {
      if (rawResources[newLang]) setLang(newLang);
    },
    [rawResources],
  );

  const getLanguages = useCallback(() => languages, [languages]);

  const ctx: I18nContextValue = useMemo(
    () => ({ t, setLanguage, getLanguages, currentLanguage: lang }),
    [t, setLanguage, getLanguages, lang],
  );

  return <LanguageContext.Provider value={ctx}>{children}</LanguageContext.Provider>;
}
