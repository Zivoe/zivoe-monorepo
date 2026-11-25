import { Img, Section, Text } from '@react-email/components';

import { BASE_URL } from '../../base-url';
import { THOR_AVATAR_URL } from '../config';
import { EmailButton } from './email-button';

export function ContactCtaSection({
  ctaText = 'Book a Call',
  ctaHref = `${BASE_URL}/meet/thor`
}: {
  ctaText?: string;
  ctaHref?: string;
}) {
  return (
    <>
      <EmailButton href={ctaHref} label={ctaText} />

      <Section className="mt-6">
        <table>
          <tr>
            <td style={{ verticalAlign: 'top', paddingRight: '12px' }}>
              <Img src={THOR_AVATAR_URL} width="48" height="48" alt="Thor" style={{ borderRadius: '50%' }} />
            </td>

            <td>
              <Text className="m-0 font-medium text-neutral-950">Thor</Text>
              <Text className="text-sm m-0 text-neutral-500">Onboarding, Zivoe</Text>
            </td>
          </tr>
        </table>
      </Section>
    </>
  );
}
