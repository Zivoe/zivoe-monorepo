import { Address } from 'viem';

import mainnetContracts from './mainnet.json';
import sepoliaContracts from './sepolia.json';

export const NETWORKS = ['MAINNET', 'SEPOLIA'] as const;
export type Network = (typeof NETWORKS)[number];

export type Contracts = {
  USDC: Address;
  GBL: Address;
  zSTT: Address;
  stSTT: Address;
  OCC_USDC: Address;
  ZIVOE_VAULT: Address;
};

export const getContracts = ({ network }: { network: Network }) => {
  return network === 'SEPOLIA' ? (sepoliaContracts as Contracts) : (mainnetContracts as Contracts);
};
