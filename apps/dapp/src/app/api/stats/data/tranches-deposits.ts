import 'server-only';

import { type GetContractEventsReturnType, type PublicClient, formatUnits, getAddress, parseUnits } from 'viem';

import { Contracts } from '@zivoe/contracts';
import { zivoeItoAbi, zivoeTranchesAbi } from '@zivoe/contracts/abis';

const DECIMALS = 18;

export type TranchesDeposit = {
  address: string;
  senior: string;
  junior: string;
  total: string;
};

type DepositsMap = Map<string, { senior: bigint; junior: bigint }>;

export const getTranchesDeposits = async ({
  client,
  contracts,
  type
}: {
  client: PublicClient;
  contracts: Contracts;
  type: 'ITO' | 'ZVT';
}) => {
  const isITO = type === 'ITO';

  const [seniorDepositLogs, juniorDepositLogs] = await Promise.all([
    client.getContractEvents({
      address: isITO ? contracts.ITO : contracts.ZVT,
      abi: isITO ? zivoeItoAbi : zivoeTranchesAbi,
      eventName: 'SeniorDeposit',
      fromBlock: 'earliest',
      toBlock: 'latest'
    }),

    client.getContractEvents({
      address: isITO ? contracts.ITO : contracts.ZVT,
      abi: isITO ? zivoeItoAbi : zivoeTranchesAbi,
      eventName: 'JuniorDeposit',
      fromBlock: 'earliest',
      toBlock: 'latest'
    })
  ]);

  const depositsMap: DepositsMap = new Map();
  processDeposits({ logs: seniorDepositLogs, depositsMap, trancheType: 'senior', contracts });
  processDeposits({ logs: juniorDepositLogs, depositsMap, trancheType: 'junior', contracts });

  const deposits: Array<TranchesDeposit> = [];
  for (const [address, amounts] of depositsMap.entries()) {
    const senior = formatUnits(amounts.senior, DECIMALS);
    const junior = formatUnits(amounts.junior, DECIMALS);
    const total = formatUnits(amounts.senior + amounts.junior, DECIMALS);

    deposits.push({
      address,
      senior,
      junior,
      total
    });
  }

  return deposits.sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
};

type DepositLogs = GetContractEventsReturnType<typeof zivoeItoAbi, 'SeniorDeposit' | 'JuniorDeposit'>;

const processDeposits = ({
  logs,
  depositsMap,
  trancheType,
  contracts
}: {
  logs: DepositLogs;
  depositsMap: DepositsMap;
  trancheType: 'senior' | 'junior';
  contracts: Contracts;
}) => {
  for (const log of logs) {
    const { account, amount, asset } = log.args;
    if (!account || !amount || !asset) continue;

    const address = getAddress(account);
    const existing = depositsMap.get(address) || { senior: 0n, junior: 0n };

    let amountWei = amount;
    if (asset === contracts.USDC || asset === contracts.USDT) {
      amountWei = parseUnits(amountWei.toString(), DECIMALS - 6);
    }

    if (trancheType === 'senior') existing.senior += amountWei;
    else existing.junior += amountWei;

    depositsMap.set(address, existing);
  }
};
