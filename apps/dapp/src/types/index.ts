import { PublicClient } from 'viem';

import { Contracts } from '@zivoe/contracts';

export type Web3Request = {
  client: PublicClient;
  contracts: Contracts;
  blockNumber: bigint;
};
