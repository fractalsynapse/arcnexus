import { createContext, useContext } from 'react';
import type { Navigate } from './use-workspace-path.js';

export const workspaceRoute = createContext<{ path: string; navigate?: Navigate }>({ path: '/' });

/** Read the selected route inside any registered workspace surface. */
export function useWorkspaceRoute() {
  return useContext(workspaceRoute);
}
