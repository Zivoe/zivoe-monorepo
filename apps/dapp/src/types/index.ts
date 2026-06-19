import { type PublicClient } from 'viem';

import { type Contracts } from '@zivoe/contracts';

export type Web3Request = {
  client: PublicClient;
  contracts: Contracts;
  blockNumber: bigint;
};
