import { type AssetHolding } from '@/portfolio/model';

import { ChainLabel } from './chain-label';
import { amount, money } from './common';

const requestAmount = (value: bigint, known: boolean) =>
  known ? amount(value) : value > 0n ? `${amount(value)}*` : '—';

export function ChainHoldingsTable({ holding }: { holding: AssetHolding }) {
  if (!holding.chains.length)
    return <p className="text-small text-secondary">This asset is unsupported in the current environment.</p>;

  const incomplete = holding.chains.some((chain) => !chain.complete);
  return (
    <div className="min-w-0">
      <p className="mb-3 text-extraSmall text-secondary">Balances in {holding.asset}; estimated values in USD.</p>
      <div
        role="region"
        aria-label={`${holding.asset} chain breakdown`}
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-default focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <table className="w-full min-w-[32rem] text-right text-small tabular-nums">
          <caption className="sr-only">{holding.asset} balances by chain</caption>
          <thead className="bg-surface-elevated text-extraSmall text-secondary">
            <tr>
              {['Chain', 'Available', 'Pending', 'Claimable', 'Est. value'].map((label) => (
                <th key={label} scope="col" className="px-3 py-2.5 font-medium whitespace-nowrap first:text-left">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holding.chains.map((chain) => (
              <tr key={chain.chain} className="border-t border-default">
                <th scope="row" className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-primary">
                  <ChainLabel chain={chain.chain} />
                  {!chain.complete && (
                    <span className="ml-2 text-extraSmall font-normal text-secondary">Incomplete</span>
                  )}
                </th>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {chain.availableKnown ? amount(chain.available) : '—'}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{requestAmount(chain.pending, chain.requestsKnown)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{requestAmount(chain.claimable, chain.requestsKnown)}</td>
                <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                  {chain.complete ? money(chain.valueD18) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {incomplete && (
        <p className="mt-3 text-extraSmall text-secondary">
          Incomplete chains show known amounts only; these may be partial or out of date. * Partial request amount.
          Refresh to check again.
        </p>
      )}
    </div>
  );
}
