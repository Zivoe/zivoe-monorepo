import { formatUnits } from 'viem';

import { getContracts } from '@zivoe/contracts';
import { zivoeVaultAbi } from '@zivoe/contracts/abis';

import { getWeb3Client } from '@/server/clients/web3';

import { env } from '@/env';

const handler = async () => {
  const network = env.NEXT_PUBLIC_NETWORK;

  const client = getWeb3Client(network);
  const contracts = getContracts(network);

  const supply = await client.readContract({
    address: contracts.ZIVOE_VAULT,
    abi: zivoeVaultAbi,
    functionName: 'totalSupply'
  });

  const result = formatUnits(supply, 18);

  return Response.json({ result });
};

export const GET = handler;
