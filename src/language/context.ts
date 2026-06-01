import { createContext } from 'react';
import type { I18nContextValue } from './types.js';

export const LanguageContext = createContext<I18nContextValue | null>(null);
