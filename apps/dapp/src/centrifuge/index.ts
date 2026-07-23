// The Centrifuge Module's public surface — the only import path for pages and
// components. SDK types and Observables never leave this module.
export { CENTRIFUGE_CONFIG, getCentrifugeConfig, type CentrifugeConfig } from './config';
export { useDepositPreview, useInvestment, useVaultCapacity } from './hooks';
export type { DepositPreview, Investment, VaultCapacity } from './types';
