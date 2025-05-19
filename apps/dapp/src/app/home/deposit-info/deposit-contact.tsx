import { Link } from '@zivoe/ui/core/link';
import { EmailIcon } from '@zivoe/ui/icons';

import { DepositInfoSection } from './common';

export default function DepositContact() {
  return (
    <DepositInfoSection title="Contact Us" icon={<EmailIcon />}>
      <p className="text-leading text-primary">
        If you have any questions, contact us at{' '}
        <Link
          variant="link-neutral-dark"
          className="underline underline-offset-8 hover:no-underline"
          href="mailto:invest@zivoe.com"
        >
          invest@zivoe.com
        </Link>
        .
      </p>
    </DepositInfoSection>
  );
}
