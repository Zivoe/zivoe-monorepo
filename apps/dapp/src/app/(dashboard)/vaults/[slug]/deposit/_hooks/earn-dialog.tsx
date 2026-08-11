'use client';

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  createContext,
  useContext,
  useMemo,
  useState
} from 'react';

type EarnDialogState = { isOpen: boolean; setIsOpen: Dispatch<SetStateAction<boolean>> };

const EarnDialogContext = createContext<EarnDialogState | null>(null);

/**
 * The mobile Earn dialog's open state, owned by the Zivoe Vault page tree — which
 * the route keys by slug, so navigating to another Zivoe Vault unmounts the state
 * instead of resetting it. A dialog opened on one Zivoe Vault can never linger
 * onto another, and nothing races the `?view=` deep-link auto-open the way a
 * global-atom reset effect would.
 */
export function EarnDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo(() => ({ isOpen, setIsOpen }), [isOpen]);

  return <EarnDialogContext.Provider value={value}>{children}</EarnDialogContext.Provider>;
}

/** Open state and stable setter — effects should depend on the setter only. */
export function useEarnDialog(): EarnDialogState {
  const state = useContext(EarnDialogContext);
  if (!state) throw new Error('useEarnDialog must be used under the Zivoe Vault deposit tree.');
  return state;
}
