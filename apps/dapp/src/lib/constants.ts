import { getContracts } from '@zivoe/contracts';

import { env } from '@/env';

export const NETWORK = env.NEXT_PUBLIC_NETWORK;
export const CONTRACTS = getContracts(NETWORK);
