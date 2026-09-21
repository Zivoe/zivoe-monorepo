import { LIGHTHOUSE_URL } from '@/lib/utils';

import { LighthouseMark } from './lighthouse-mark';
import { PillCta, type PillCtaSize } from './pill-cta';

export function LighthouseCta({ size }: { size?: PillCtaSize }) {
  return (
    <PillCta
      href={LIGHTHOUSE_URL}
      title="Lighthouse"
      icon={<LighthouseMark className="size-full" />}
      tone="teal"
      size={size}
    />
  );
}
