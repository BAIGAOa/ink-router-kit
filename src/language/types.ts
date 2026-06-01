import { ReactNode } from 'react';

export interface LanguageProviderProps {
  children: ReactNode;
  resources?: Record<string, Record<string, string>>;
  path?: string;
  defaultLanguage?: string;
  fallbackLanguage?: string;
}

export interface I18nContextValue {
  t: (key: string, params?: Record<string, string | number>) => string;
  setLanguage: (lang: string) => void;
  getLanguages: () => string[];
  currentLanguage: string;
}
