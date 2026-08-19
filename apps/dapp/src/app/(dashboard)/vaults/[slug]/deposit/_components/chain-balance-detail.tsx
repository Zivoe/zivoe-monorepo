'use client';

import { formatBigIntToReadable } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useBalance } from '@/hooks/useBalance';

import { type TransactionIdentity } from '@/centrifuge';

/**
 * A chain selector row's right-hand detail: the wallet's balance of the token
 * that row's flow would spend on that chain — the deposit selector shows each
 * chain's USDC, the redeem selector each chain's share token. Prints a number
 * only once the query returned one: a stated "0.00" while the read is pending
 * (or failed) would be a wrong fact, not a placeholder.
 */
export function ChainBalanceDetail({ identity, token }: { identity: TransactionIdentity; token: 'usdc' | 'share' }) {
  const account = useAccount();
  const { chain, usdc, shareClass } = identity.centrifugeVault;
  const { tokenAddress, decimals } =
    token === 'usdc'
      ? { tokenAddress: usdc.address, decimals: usdc.decimals }
      : { tokenAddress: shareClass.shareTokenAddress, decimals: shareClass.decimals };
  const balance = useBalance({ chain, tokenAddress });

  if (!account.address) return null;

  return (
    <p className="text-small text-tertiary">
      Balance:{' '}
      <span className="font-medium text-primary">
        {balance.data === undefined ? '—' : formatBigIntToReadable(balance.data, decimals)}
      </span>
    </p>
  );
}
