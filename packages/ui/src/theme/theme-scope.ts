import { createContext } from 'react';
import type { Theme } from './theme-preferences.js';

export const themeScope = createContext<Theme | undefined>(undefined);
