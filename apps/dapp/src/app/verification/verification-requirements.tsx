import { type ReactNode } from 'react';

import { Link } from '@zivoe/ui/core/link';
import { BankIcon, CameraIcon, DocumentIcon, UserIcon } from '@zivoe/ui/icons';

import { type InvestorPath } from '@/server/verification/verification-status';

import { ATTESTATION_LETTER_HREF } from './verification-documents';

/** The United States and its territories: a subject resident or incorporated in any of them is a U.S. investor. */
const US_JURISDICTIONS = new Set(['US', 'PR', 'VI', 'GU', 'AS', 'MP', 'UM']);

export const isUsJurisdiction = (countryCode: string | null) => !!countryCode && US_JURISDICTIONS.has(countryCode);

export type VerificationRequirement = {
  id: string;
  title: string;
  description: ReactNode;
  Icon: typeof DocumentIcon;
};

/**
 * What a subject must have ready before its Persona flow, for the "Prepare your documents" checklist: it
 * turns on two facts only, a person or an organization, and U.S. or not (`countryCode` is the country of
 * residence or of incorporation). An accreditation document is asked of U.S. investors only.
 */
export function verificationRequirements({
  path,
  countryCode
}: {
  path: InvestorPath;
  countryCode: string | null;
}): Array<VerificationRequirement> {
  const isUs = isUsJurisdiction(countryCode);

  if (path === 'individual') {
    return [
      { id: 'photo_id', title: 'Photo ID', description: 'A valid, government-issued photo ID.', Icon: UserIcon },
      {
        id: 'camera',
        title: 'Device with a camera',
        description: 'A phone or computer with a camera to take a selfie.',
        Icon: CameraIcon
      },
      ...(isUs ? [accreditation({ title: 'Accreditation document', who: 'you are' })] : [])
    ];
  }

  return [
    {
      id: 'business_address',
      title: 'Business Address',
      description: 'Your entity’s physical address and registered address.',
      Icon: BankIcon
    },
    isUs
      ? {
          id: 'ein',
          title: 'Employer Identification Number (EIN)',
          description: 'Your entity’s 9-digit federal tax ID, issued by the IRS.',
          Icon: DocumentIcon
        }
      : {
          id: 'tin',
          title: 'Tax Identification Number (TIN)',
          description:
            'Your entity’s tax or business registration number, issued by the country where it is registered.',
          Icon: DocumentIcon
        },
    {
      id: 'ubos',
      title: 'Ultimate Beneficial Owners (UBOs)',
      description: 'The names and emails of each individual who owns 25% or more of the entity.',
      Icon: UserIcon
    },
    {
      id: 'formation_document',
      title: 'Formation Document',
      description: 'Certificate of Incorporation, Certificate of Formation, Certificate of Registration, etc.',
      Icon: DocumentIcon
    },
    ...(isUs ? [accreditation({ title: 'Accreditation Document', who: 'your entity is' })] : [])
  ];
}

/** The item's title and words as given for each path; they differ in case too. */
function accreditation({ title, who }: { title: string; who: 'you are' | 'your entity is' }): VerificationRequirement {
  return {
    id: 'accreditation',
    title,
    description: (
      <>
        One of the following: (i) an{' '}
        <Link
          href={ATTESTATION_LETTER_HREF}
          target="_blank"
          hideExternalLinkIcon
          variant="link-primary"
          size="m"
          // Underlined in the prose, close to its line: the variant's hover offset (8 px) lands under the next line.
          className="inline text-small whitespace-normal underline underline-offset-4 hover:underline-offset-4"
        >
          Attestation Letter
        </Link>{' '}
        signed by a licensed attorney, certified public accountant, registered broker-dealer or registered investment
        adviser, or (ii) Other Documents proving {who} an Accredited Investor.
      </>
    ),
    Icon: DocumentIcon
  };
}
