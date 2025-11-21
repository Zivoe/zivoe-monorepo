import { Address } from 'viem';

import mainnetContracts from './mainnet.json';

export type Contracts = {
  M0: Address;
  USDC: Address;
  USDT: Address;
  frxUSD: Address;
  ITO: Address;
  GBL: Address;
  vestZVE: Address;
  DAO: Address;
  YDL: Address;
  zSTT: Address;
  zJTT: Address;
  stSTT: Address;
  stJTT: Address;
  ZVT: Address;
  OCC_USDC: Address;
  OCC_Variable: Address;
  OCC_Cycle: Address;
  zVLT: Address;
  zRTR: Address;
  OCT_CONVERT: Address;
  OCT_DAO: Address;
  OCR: Address;
  OCR_Cycle: Address;
  aUSDC: Address;
  UNISWAP_V3_POOL: Address | null;
};

export const CONTRACTS = mainnetContracts as Contracts;
