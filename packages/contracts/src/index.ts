import { Address } from 'viem';

import mainnetContracts from './mainnet.json';
import sepoliaContracts from './sepolia.json';

export const NETWORKS = ['MAINNET', 'SEPOLIA'] as const;
export type Network = (typeof NETWORKS)[number];

export type Contracts = {
  USDC: Address;
  GBL: Address;
  DAO: Address;
  zSTT: Address;
  stSTT: Address;
  OCC_USDC: Address;
  ZIVOE_VAULT: Address;
  OCT_CONVERT: Address;
};

export const getContracts = (network: Network) => {
  return network === 'SEPOLIA' ? (sepoliaContracts as Contracts) : (mainnetContracts as Contracts);
};
