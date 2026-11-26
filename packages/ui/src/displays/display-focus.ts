import { createContext } from 'react';

export interface DisplayFocus {
  focused?: string;
  toggle?: (id: string) => void;
}

export const displayFocus = createContext<DisplayFocus>({});
