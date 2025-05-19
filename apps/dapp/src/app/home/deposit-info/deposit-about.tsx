import { InfoIcon } from '@zivoe/ui/icons';

import { DepositInfoSection } from './common';

export default function DepositAbout() {
  return (
    <DepositInfoSection title="About" icon={<InfoIcon />}>
      <p className="text-leading text-primary">
        The Zivoe Credit Fund (zVLT) offers qualified purchasers exposure to a diversified portfolio of nonprime
        consumer loans with 24/7 liquidity via secondary markets.
      </p>
    </DepositInfoSection>
  );
}
