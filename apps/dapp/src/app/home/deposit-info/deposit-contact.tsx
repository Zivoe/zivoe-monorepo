import { Link } from '@zivoe/ui/core/link';
import { EmailIcon } from '@zivoe/ui/icons';

import InfoSection from '@/components/info-section';

export default function DepositContact() {
  return (
    <InfoSection title="Contact Us" icon={<EmailIcon />}>
      <p className="text-leading text-primary">
        If you have any questions, contact us at{' '}
        <Link
          variant="link-neutral-dark"
          className="underline underline-offset-8 hover:no-underline"
          href="mailto:investors@zivoe.com"
        >
          investors@zivoe.com
        </Link>
        .
      </p>
    </InfoSection>
  );
}
