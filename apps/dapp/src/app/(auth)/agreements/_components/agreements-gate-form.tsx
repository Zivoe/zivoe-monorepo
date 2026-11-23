'use client';

import { withNext } from '@/lib/lighthouse';

import { AgreementsForm } from '@/app/verification/agreements-form';

import { Auth } from '../../_components/common';
import { SignOutButton } from '../../_components/sign-out-button';

/** `isUpdate` tells someone who accepted an earlier version that the agreements changed, instead of asking afresh. */
export default function AgreementsGateForm({ next, isUpdate }: { next?: string; isUpdate: boolean }) {
  return (
    <>
      <Auth.Container>
        <Auth.Header
          title={isUpdate ? "We've Updated Our Agreements" : 'Review the agreements'}
          description={
            isUpdate
              ? 'The agreements have changed since you last accepted them. Please review and accept the updated agreements to keep using Zivoe.'
              : 'Open each document, then confirm your agreement to continue.'
          }
        />

        {/* A full load: post-signin picks the page in `next` or the way back to Lighthouse, which can end cross-origin. */}
        <AgreementsForm
          onAccepted={() => window.location.assign(withNext('/api/auth/post-signin', next))}
          // Every other page sends them back here, so this is the one way to another account.
          secondaryAction={<SignOutButton variant="ghost-light">Sign out</SignOutButton>}
        />
      </Auth.Container>

      <Auth.CopyrightFooter />
    </>
  );
}
