'use client';

import { useState } from 'react';

import { type AccountType } from '@/lib/schemas/onboarding';

import { Auth } from '../../_components/common';
import AccountTypeForm from './account-type-form';
import IndividualForm from './individual-form';
import OrganizationForm from './organization-form';

export default function OnboardingForm() {
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  return (
    <>
      <Auth.Container>
        {!accountType && <AccountTypeForm onSubmit={(type) => setAccountType(type)} />}
        {accountType === 'individual' && <IndividualForm onBack={() => setAccountType(null)} />}
        {accountType === 'organization' && <OrganizationForm onBack={() => setAccountType(null)} />}
      </Auth.Container>

      <Auth.HelpFooter />
    </>
  );
}
