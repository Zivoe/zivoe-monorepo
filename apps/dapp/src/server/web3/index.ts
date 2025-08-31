import { Address, erc20Abi, formatUnits, parseUnits } from 'viem';

import { Network } from '@zivoe/contracts';
import { occModularAbi, occVariableAbi, zivoeTrancheTokenAbi } from '@zivoe/contracts/abis';
import { zivoeRewardsAbi, zivoeVaultAbi } from '@zivoe/contracts/abis';

import { CONTRACTS, NETWORK } from '@/lib/constants';
import { DAYS_PER_YEAR, handlePromise } from '@/lib/utils';
import { DAY_IN_SECONDS } from '@/lib/utils';

import { TVL, Web3Request } from '@/types';

const getIndexPrice = async ({
  client,
  contracts,
  blockNumber
}: Omit<Web3Request, 'blockNumber'> & { blockNumber: bigint | undefined }) => {
  const totalSupply = await client.readContract({
    address: contracts.zVLT,
    abi: zivoeVaultAbi,
    functionName: 'totalSupply',
    blockNumber
  });

  const vaultTotalAssets = await client.readContract({
    address: contracts.zVLT,
    abi: zivoeVaultAbi,
    functionName: 'totalAssets',
    blockNumber
  });

  const amount = parseUnits(vaultTotalAssets.toString(), 18);
  const indexPrice = totalSupply !== 0n ? Number(formatUnits(amount / totalSupply, 18)) : 0;

  return { indexPrice, vaultTotalAssets: vaultTotalAssets.toString() };
};

const COMPOUNDING_PERIOD = 15;

const getAPY = async ({ client, contracts, blockNumber }: Web3Request) => {
  const rewardRateRes = await client.readContract({
    address: contracts.stSTT,
    abi: zivoeRewardsAbi,
    functionName: 'rewardData',
    args: [contracts.USDC],
    blockNumber
  });

  const totalSupplyRes = await client.readContract({
    address: contracts.stSTT,
    abi: zivoeRewardsAbi,
    functionName: 'totalSupply',
    blockNumber
  });

  const rewardRate = Number(rewardRateRes[2]);
  const totalSupply = Number(totalSupplyRes);

  const rewardRatePerDay = rewardRate * DAY_IN_SECONDS;
  const rewardRatePerYear = rewardRatePerDay * DAYS_PER_YEAR;
  const apr = rewardRatePerYear / totalSupply;

  const dailyRate = apr / DAYS_PER_YEAR;
  const periodRate = dailyRate * COMPOUNDING_PERIOD;
  const periodsPerYear = DAYS_PER_YEAR / COMPOUNDING_PERIOD;
  const apy = ((1 + periodRate) ** periodsPerYear - 1) * 100;

  return Number(apy.toFixed(6));
};

const getDecimals = (network: Network) => {
  return {
    USDC: 6,
    USDT: 6,
    frxUSD: 18,
    M0: 6,
    aUSDC: network === 'SEPOLIA' ? 18 : 6
  } as const;
};

// Normalize to 18 decimals for consistent calculation
const normalizeToDecimals18 = (value: bigint, decimals: number): bigint => {
  return value * 10n ** BigInt(18 - decimals);
};

const OCC_USDC_LOAN_ID = 0n;

const OCC_VARIABLE_BORROWER = '0x50C72Ff8c5e7498F64BEAeB8Ed5BE83CABEB0Fd5' as const;
const OCC_VARIABLE_START_BLOCK = 23228086n;

const getTVL = async ({ client, contracts, blockNumber }: Web3Request) => {
  const getBalance = (address: Address, holder: Address) =>
    client.readContract({
      address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [holder],
      blockNumber
    });

  const [
    usdcInDAO,
    usdcInYDL,
    usdcInStSTT,
    usdcInOCT_DAO,
    usdcInOCC_Variable,
    usdtInDAO,
    usdtInOCT_DAO,
    frxUSDInDAO,
    frxUSDInOCT_DAO,
    m0InDAO,
    m0InOCT_DAO,
    aUSDCInOCR,
    loanInfo,
    loanVariableInfo
  ] = await Promise.all([
    getBalance(contracts.USDC, CONTRACTS.DAO),
    getBalance(contracts.USDC, CONTRACTS.YDL),
    getBalance(contracts.USDC, CONTRACTS.stSTT),
    getBalance(contracts.USDC, CONTRACTS.OCT_DAO),
    getBalance(contracts.USDC, CONTRACTS.OCC_Variable),

    getBalance(contracts.USDT, CONTRACTS.DAO),
    getBalance(contracts.USDT, CONTRACTS.OCT_DAO),

    getBalance(contracts.frxUSD, CONTRACTS.DAO),
    getBalance(contracts.frxUSD, CONTRACTS.OCT_DAO),

    getBalance(contracts.M0, CONTRACTS.DAO),
    getBalance(contracts.M0, CONTRACTS.OCT_DAO),

    getBalance(contracts.aUSDC, CONTRACTS.OCR),

    client.readContract({
      address: contracts.OCC_USDC,
      abi: occModularAbi,
      functionName: 'loans',
      args: [OCC_USDC_LOAN_ID],
      blockNumber
    }),

    handlePromise(
      client.readContract({
        address: contracts.OCC_Variable,
        abi: occVariableAbi,
        functionName: 'usage',
        args: [OCC_VARIABLE_BORROWER],
        blockNumber
      })
    )
  ]);

  const decimals = getDecimals(NETWORK);

  const usdcTotal = normalizeToDecimals18(
    usdcInDAO + usdcInYDL + usdcInStSTT + usdcInOCT_DAO + usdcInOCC_Variable,
    decimals.USDC
  );
  const usdtTotal = normalizeToDecimals18(usdtInDAO + usdtInOCT_DAO, decimals.USDT);
  const frxUSDTotal = normalizeToDecimals18(frxUSDInDAO + frxUSDInOCT_DAO, decimals.frxUSD);
  const stablecoinsTotal = usdcTotal + usdtTotal + frxUSDTotal;

  const m0Total = normalizeToDecimals18(m0InDAO + m0InOCT_DAO, decimals.M0);
  const treasuryBillsTotal = m0Total;

  const aUSDCTotal = normalizeToDecimals18(aUSDCInOCR, decimals.aUSDC);
  const deFiTotal = aUSDCTotal;

  let loanVariableAmount: bigint | undefined;
  if (loanVariableInfo.err || loanVariableInfo.res === undefined) {
    if (blockNumber >= OCC_VARIABLE_START_BLOCK) {
      throw new Error('Failed to get loan variable amount');
    } else {
      loanVariableAmount = 0n;
    }
  } else {
    loanVariableAmount = loanVariableInfo.res;
  }

  const loansTotal = normalizeToDecimals18(loanInfo[1] + loanVariableAmount, decimals.USDC);

  const tvl = stablecoinsTotal + treasuryBillsTotal + deFiTotal + loansTotal;

  const tvlBreakdown: TVL = {
    total: tvl.toString(),
    stablecoins: {
      total: stablecoinsTotal.toString(),
      usdc: usdcTotal.toString(),
      usdt: usdtTotal.toString(),
      frxUSD: frxUSDTotal.toString()
    },
    treasuryBills: {
      total: treasuryBillsTotal.toString(),
      m0: m0Total.toString()
    },
    deFi: {
      total: deFiTotal.toString(),
      aUSDC: aUSDCTotal.toString()
    },
    loans: { total: loansTotal.toString() }
  };

  return tvlBreakdown;
};

const getZSTTTotalSupply = async ({ client, contracts, blockNumber }: Web3Request) => {
  const totalSupply = await client.readContract({
    address: contracts.zSTT,
    abi: zivoeTrancheTokenAbi,
    functionName: 'totalSupply',
    blockNumber
  });

  return totalSupply;
};

export const web3 = {
  getIndexPrice,
  getAPY,
  getTVL,
  getZSTTTotalSupply
};
