import { ZSmbLogo } from '@zivoe/ui/icons';

import { PillCta } from './pill-cta';

export function VaultsCta() {
  return (
    <PillCta
      href="https://app.zivoe.com/vaults/"
      title="Vaults"
      icon={<ZSmbLogo className="size-10" />}
      tone="orange"
    />
  );
}
