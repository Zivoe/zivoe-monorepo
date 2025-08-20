import { Address } from 'viem';

import mainnetContracts from './mainnet.json';
import sepoliaContracts from './sepolia.json';

export const NETWORKS = ['MAINNET', 'SEPOLIA'] as const;
export type Network = (typeof NETWORKS)[number];

export type Contracts = {
  M0: Address;
  USDC: Address;
  USDT: Address;
  frxUSD: Address;
  GBL: Address;
  DAO: Address;
  zSTT: Address;
  stSTT: Address;
  OCC_USDC: Address;
  zVLT: Address;
  zRTR: Address;
  OCT_CONVERT: Address;
  OCT_DAO: Address;
  OCR: Address;
};

export const getContracts = (network: Network) => {
  return network === 'SEPOLIA' ? (sepoliaContracts as Contracts) : (mainnetContracts as Contracts);
};
