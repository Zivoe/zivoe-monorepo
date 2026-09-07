import { Tooltip, TooltipFocusable, TooltipTrigger } from '@zivoe/ui/core/tooltip';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { type ZivoeVault, zivoeVaultChainDisplays, zivoeVaultDepositAssets } from '@/zivoe-vaults';

import { getTokenInfo } from './token-info';

/**
 * The logo rows the listing card and the Zivoe Vault's Details section both
 * render — one component per fact, so the two surfaces cannot disagree about
 * which stablecoins are accepted or which chains a Zivoe Vault is available on.
 * Every logo names itself on hover; the chain row overlaps its logos so nine
 * chains still fit beside the row label at 375px.
 */
export function AcceptedStablecoinIcons({ zivoeVault }: { zivoeVault: ZivoeVault }) {
  return (
    <IconRow className="gap-1.5">
      {zivoeVaultDepositAssets(zivoeVault).map(({ symbol }) => {
        const info = getTokenInfo(symbol);
        return (
          <Logo key={symbol} label={info?.label ?? symbol}>
            {info?.icon ?? symbol}
          </Logo>
        );
      })}
    </IconRow>
  );
}

/** Ring colour behind each overlapped logo — must match the surface the row sits on. */
const STACK_RING = { base: 'ring-neutral-0', elevated: 'ring-neutral-50' } as const;

export function AcceptedChainIcons({
  zivoeVault,
  surface = 'base'
}: {
  zivoeVault: ZivoeVault;
  surface?: keyof typeof STACK_RING;
}) {
  return (
    <IconRow className="-space-x-1">
      {zivoeVaultChainDisplays(zivoeVault).map(({ label, Icon }) => (
        <Logo key={label} label={label} className={cn('ring-2', STACK_RING[surface])}>
          <Icon />
        </Logo>
      ))}
    </IconRow>
  );
}

// `relative z-20` lifts the row above the listing card's whole-card link
// overlay (z-10) so the logos receive hover; the Details section has no
// overlay, where it is inert.
function IconRow({ className, children }: { className: string; children: React.ReactNode }) {
  return <div className={cn('relative z-20 flex shrink-0 items-center', className)}>{children}</div>;
}

function Logo({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <TooltipTrigger>
      <TooltipFocusable>
        <span
          role="img"
          aria-label={label}
          className={cn(
            'relative rounded-full outline-hidden hover:z-10 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-default [&_svg]:size-5',
            className
          )}
        >
          {children}
        </span>
      </TooltipFocusable>
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
