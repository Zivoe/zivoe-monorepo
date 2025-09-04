import 'server-only';

import { type PublicClient, formatUnits, getAddress } from 'viem';

import type { Contracts } from '@zivoe/contracts';
import { zivoeVaultAbi } from '@zivoe/contracts/abis';

import { ApiError } from '@/lib/utils';

const DECIMALS = 18;

export type ZvltDeposit = {
  address: string;
  amount: string;
  transactionHashes: Array<string>;
};

type DepositsMap = Map<string, { amount: bigint; transactionHashes: Set<string> }>;

export const getZVLTDeposits = async ({ client, contracts }: { client: PublicClient; contracts: Contracts }) => {
  const depositEvents = await client.getContractEvents({
    address: contracts.zVLT,
    abi: zivoeVaultAbi,
    eventName: 'Deposit',
    fromBlock: 'earliest',
    toBlock: 'latest'
  });

  const depositsMap: DepositsMap = new Map();

  for (const event of depositEvents) {
    const transactionHash = event.transactionHash;
    const owner = event.args?.owner;
    const assets = event.args?.assets;

    if (!owner || !assets) throw new ApiError({ message: 'Invalid deposit event', status: 500 });

    const ownerAddress = getAddress(owner);

    const existing = depositsMap.get(ownerAddress);
    if (existing) {
      existing.amount += assets;
      existing.transactionHashes.add(transactionHash);
      depositsMap.set(ownerAddress, existing);
    } else {
      depositsMap.set(ownerAddress, {
        amount: assets,
        transactionHashes: new Set([transactionHash])
      });
    }
  }

  const deposits: Array<ZvltDeposit> = [];
  for (const [address, data] of depositsMap.entries()) {
    deposits.push({
      address,
      amount: formatUnits(data.amount, DECIMALS),
      transactionHashes: Array.from(data.transactionHashes)
    });
  }

  return deposits.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
};
