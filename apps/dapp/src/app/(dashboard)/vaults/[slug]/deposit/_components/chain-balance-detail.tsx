'use client';

import { formatBigIntToReadable } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useBalance } from '@/hooks/useBalance';

import { type TransactionIdentity } from '@/centrifuge';

/**
 * A chain selector row's right-hand detail: the wallet's balance of the token
 * that row's flow would spend on that chain — the deposit selector shows each
 * chain's deposit asset, the redeem selector each chain's share token. Prints a number
 * only once the query returned one: a stated "0.00" while the read is pending
 * (or failed) would be a wrong fact, not a placeholder.
 */
export function ChainBalanceDetail({ identity, token }: { identity: TransactionIdentity; token: 'asset' | 'share' }) {
  const account = useAccount();
  const { chain, asset, shareClass } = identity.centrifugeVault;
  const { tokenAddress, decimals } =
    token === 'asset'
      ? { tokenAddress: asset.address, decimals: asset.decimals }
      : { tokenAddress: shareClass.shareTokenAddress, decimals: shareClass.decimals };
  const balance = useBalance({ chain, tokenAddress });

  if (!account.address || balance.data === undefined) return null;

  return (
    <p className="text-small text-tertiary">
      Balance: <span className="font-medium text-primary">{formatBigIntToReadable(balance.data, decimals)}</span>
    </p>
  );
}
