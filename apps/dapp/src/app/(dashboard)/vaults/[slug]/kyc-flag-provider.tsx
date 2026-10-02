'use client';

import { type ReactNode, createContext, useContext } from 'react';

// The `kyc` flag as the vault page evaluated it on the server (see
// `isKycEnabled`). Off by default: a tree the page does not wrap gets the app
// without KYC. Remove with the flag at launch.
const KycFlagContext = createContext(false);

export function KycFlagProvider({ isEnabled, children }: { isEnabled: boolean; children: ReactNode }) {
  return <KycFlagContext.Provider value={isEnabled}>{children}</KycFlagContext.Provider>;
}

/** Whether the whitelist UX points to `/verification`, or keeps the pre-KYC "contact us" dead end. */
export function useIsKycEnabled(): boolean {
  return useContext(KycFlagContext);
}
