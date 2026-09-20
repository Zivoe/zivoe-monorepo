import { LighthouseMark } from '@/components/lighthouse-mark';
import { PillCta } from '@/components/pill-cta';

export function LighthouseCta() {
  return <PillCta href="https://lighthouse.zivoe.com/" title="Lighthouse" icon={<LighthouseMark />} tone="teal" />;
}
