import { Link } from '@zivoe/ui/core/link';
import { ArrowLeftIcon } from '@zivoe/ui/icons';

import ZivoeVaultIdentity, { ZivoeVaultStatusBadge } from '@/components/zivoe-vault-identity';

import { type ZivoeVault } from '@/zivoe-vaults';

/**
 * Back link over an identity row — the mock's Zivoe-Vault-page header, minus the
 * Standard/Identity/Dashboard switcher. The link goes to the homepage, which
 * is the Zivoe Vaults list this page was reached from.
 */
export default function ZivoeVaultHeader({ zivoeVault }: { zivoeVault: ZivoeVault }) {
  return (
    <div className="w-full pt-7">
      {/* -ml-3 cancels the button padding so the label lines up with the identity row below. */}
      <Link href="/" variant="ghost" size="s" className="-ml-3">
        <ArrowLeftIcon />
        Back
      </Link>

      <div className="pt-5.5 pb-1">
        <ZivoeVaultIdentity
          zivoeVault={zivoeVault}
          as="h1"
          size="lg"
          trailing={<ZivoeVaultStatusBadge status={zivoeVault.status} />}
        />
      </div>
    </div>
  );
}
