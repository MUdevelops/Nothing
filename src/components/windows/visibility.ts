import { createContext, useContext } from 'react';
/** false while the hosting window is minimized, so heavy apps can pause their render loops. */
export const VisibleCtx = createContext(true);
export const useVisible = (): boolean => useContext(VisibleCtx);
