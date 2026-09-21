import { ZSmbLogo } from '@zivoe/ui/icons';

import { APP_URL } from '@/lib/utils';

import { PillCta, type PillCtaSize } from './pill-cta';

export function VaultsCta({ size }: { size?: PillCtaSize }) {
  return <PillCta href={APP_URL} title="Vaults" icon={<ZSmbLogo />} tone="orange" size={size} />;
}
