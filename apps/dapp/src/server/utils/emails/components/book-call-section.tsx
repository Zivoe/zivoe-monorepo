import { Img, Link, Section, Text } from '@react-email/components';

import { BASE_URL } from '../../base-url';
import { THOR_AVATAR_URL } from '../config';

type BookCallSectionProps = {
  ctaText?: string;
  ctaHref?: string;
};

export function BookCallSection({
  ctaText = 'Book a Call',
  ctaHref = `${BASE_URL}/meet/thor`
}: BookCallSectionProps) {
  return (
    <>
      <Section className="my-8 text-center">
        <Link
          href={ctaHref}
          className="text-neutral-0 rounded-lg bg-primary-600 px-6 py-3 font-medium"
          style={{ display: 'inline-block' }}
        >
          {ctaText}
        </Link>
        <Text className="text-sm text-neutral-500 m-0 mt-3">
          Or reach out on Telegram{' '}
          <Link href={`${BASE_URL}/telegram/thor`} className="text-primary-600 underline">
            @thorabbasi
          </Link>
        </Text>
      </Section>

      <Section className="mt-6">
        <table>
          <tr>
            <td style={{ verticalAlign: 'top', paddingRight: '12px' }}>
              <Img src={THOR_AVATAR_URL} width="48" height="48" alt="Thor" style={{ borderRadius: '50%' }} />
            </td>

            <td>
              <Text className="text-neutral-950 m-0 font-medium">Thor</Text>
              <Text className="text-sm text-neutral-500 m-0">Onboarding, Zivoe</Text>
            </td>
          </tr>
        </table>
      </Section>
    </>
  );
}
