'use client';

import { useRouter } from 'next/navigation';

import { Auth } from '@/app/(auth)/_components/common';

import { AgreementsForm } from './agreements-form';
import { stepCountOf } from './verification-steps';

/**
 * Step three of `/verification`, once the selected account has a yes Decision and until the viewer accepts the
 * agreements in force. The person accepts for themselves, so this covers every account they act for. No Back:
 * nothing before a yes Decision opens again. Once accepted, the refresh lands the page on Wallets.
 */
export function AgreementsStep() {
  const router = useRouter();

  return (
    <>
      <Auth.Header
        title="Review the agreements"
        description="Open each document, then confirm your agreement to continue."
      >
        <Auth.StepIndicator>{stepCountOf('agreements')}</Auth.StepIndicator>
      </Auth.Header>

      <AgreementsForm onAccepted={() => router.refresh()} />
    </>
  );
}
