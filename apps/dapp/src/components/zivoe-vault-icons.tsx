import { DEPOSIT_TOKENS } from '@/types/constants';

import { type ZivoeVault, zivoeVaultChainDisplays } from '@/zivoe-vaults';

import { TOKEN_INFO } from './token-info';

/**
 * The logo rows the listing card and the Zivoe Vault's Details section both
 * render — one component per fact, so the two surfaces cannot disagree about
 * which stablecoins are accepted or which chains a Zivoe Vault is available on.
 */
export function AcceptedStablecoinIcons() {
  return (
    <IconRow>
      {DEPOSIT_TOKENS.map((asset) => (
        <Logo key={asset} label={TOKEN_INFO[asset].label}>
          {TOKEN_INFO[asset].icon}
        </Logo>
      ))}
    </IconRow>
  );
}

export function AcceptedChainIcons({ zivoeVault }: { zivoeVault: ZivoeVault }) {
  return (
    <IconRow>
      {zivoeVaultChainDisplays(zivoeVault).map(({ label, Icon }) => (
        <Logo key={label} label={label}>
          <Icon />
        </Logo>
      ))}
    </IconRow>
  );
}

function IconRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5">{children}</div>;
}

function Logo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span role="img" title={label} aria-label={label} className="[&_svg]:size-5">
      {children}
    </span>
  );
}
