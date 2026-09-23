import { Button } from '@zivoe/ui/core/button';
import { Link } from '@zivoe/ui/core/link';

import { type PortfolioModel } from '@/portfolio/model';
import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import { ChainLabel } from './chain-label';
import { Card, amount, money, vaultLink } from './common';

export function Requests({ model, refresh }: { model: PortfolioModel; refresh: () => void }) {
  const chains = [...new Set(model.requests.map((request) => request.identity.centrifugeVault.chain))];
  return (
    <Card
      title="Redemptions"
      className="order-5 lg:order-last"
      extra={
        <span className="flex items-center gap-2 rounded-full bg-surface-elevated px-3 py-1 text-small text-primary">
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 6v6l4 2" />
          </svg>
          {model.requests.length} active
        </span>
      }
    >
      {model.requestsComplete && model.requests.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-regular font-medium text-primary">No pending requests</p>
          <p className="mt-2 text-small text-secondary">
            Your redemption requests, cancellations, and funds ready to claim will appear here.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {chains.map((chain) => (
          <details key={chain} open className="rounded-lg border border-default">
            <summary className="cursor-pointer p-4 text-small font-medium text-primary focus-visible:outline-2">
              <ChainLabel chain={chain} />
            </summary>
            <div className="flex flex-col gap-3 px-4 pb-4">
              {model.requests
                .filter((request) => request.identity.centrifugeVault.chain === chain)
                .map((request) => (
                  <div key={request.id} className="rounded-lg bg-surface-elevated p-4">
                    <p className="text-extraSmall text-secondary">
                      Payout asset · {request.identity.centrifugeVault.asset.symbol}
                    </p>
                    <p className="mt-2 text-regular font-medium text-primary">
                      {amount(request.amount, request.decimals)} {request.symbol}
                    </p>
                    <p className="mt-1 text-small text-secondary">
                      {request.label}
                      {request.valueD18 !== null ? ` · ≈ ${money(request.valueD18)}` : ''}
                    </p>
                    {request.stale && (
                      <p className="mt-1 text-extraSmall text-secondary">Last known position · refresh unavailable</p>
                    )}
                    <Link className="mt-3" size="s" href={vaultLink('pending')}>
                      Manage in vault
                    </Link>
                  </div>
                ))}
            </div>
          </details>
        ))}
        {!model.requestsComplete && (
          <div role="status" className="rounded-lg bg-surface-elevated p-4 text-small text-secondary">
            {model.requestPendingChains.length > 0 && (
              <p>Still checking… {model.requestPendingChains.map((chain) => CHAIN_DISPLAY[chain].label).join(', ')}</p>
            )}
            {model.requestFailedChains.length > 0 && (
              <p>
                Requests could not be checked on{' '}
                {model.requestFailedChains.map((chain) => CHAIN_DISPLAY[chain].label).join(', ')}. Known positions are
                shown; other requests may still be active.
              </p>
            )}
            <Button variant="link-primary" size="s" onPress={refresh}>
              Retry
            </Button>
          </div>
        )}
      </div>
      {model.requests.length > 0 && (
        <p className="mt-4 text-extraSmall text-secondary">
          Current positions may combine multiple submissions. These amounts are already included in your holdings.
        </p>
      )}
    </Card>
  );
}
