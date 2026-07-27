// The Centrifuge Module's public surface — the only import path for pages and
// components. SDK types and Observables never leave this module.
export { CENTRIFUGE_CONFIG, getCentrifugeConfig, sharesToUsdc, type CentrifugeConfig } from './config';
export { isPriceUnavailableError, useDepositPreview, useInvestment, useVaultCapacity } from './hooks';
export { useCancelRedeem } from './use-cancel-redeem';
export { useClaimRedeem } from './use-claim-redeem';
export { useClaimReturnedShares } from './use-claim-returned-shares';
export { useDeposit } from './use-deposit';
export { useRequestRedeem } from './use-request-redeem';
export type { DepositPreview, Investment, VaultCapacity } from './types';
