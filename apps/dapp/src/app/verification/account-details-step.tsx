'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { toast } from '@zivoe/ui/core/sonner';

import { getCountryLabel } from '@/types/countries';

import { updateOrganization } from '@/server/actions/organizations';
import { type InvestorProfile } from '@/server/data/investor-profile';

import { ORGANIZATION_ERROR_COPY } from '@/lib/organization-copy';

import { OrganizationDetailsForm } from '@/components/organization-details-form';

import { Auth } from '@/app/(auth)/_components/common';

import { type SubjectOption } from './account-switcher';
import { LockedField, PersonalDetailsForm } from './investor-profile-step';
import { organizationIdOf, verificationHref } from './verification-href';
import { stepCountOf } from './verification-steps';

/**
 * Step one of `/verification`: the details of whoever the switcher has selected, the person's own or their
 * organization's. Editable only while that subject's verification can still start; after that they show as
 * they are, since Persona holds what was submitted. Continue saves what can be saved and moves on to the
 * Persona flow through the URL. Who is being verified is never chosen here: that is the switcher's.
 */
export function AccountDetailsStep({ subject, profile }: { subject: SubjectOption; profile: InvestorProfile }) {
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | null>(null);
  const proceed = () => router.push(verificationHref({ organizationId: organizationIdOf(subject), step: 'identity' }));

  const update = useMutation({
    // Wrapped: a server action given React Query's second argument would send it to the server too.
    mutationFn: (input: Parameters<typeof updateOrganization>[0]) => updateOrganization(input),
    onSuccess: (result) => {
      if (result.ok) return proceed();
      // Removed with the page open: the refresh takes them to their own details, so the words go in a toast.
      if (result.error.code === 'not_member') toast({ type: 'warning', title: ORGANIZATION_ERROR_COPY.not_member });
      else setRefusal(ORGANIZATION_ERROR_COPY[result.error.code]);
      router.refresh();
    },
    onError: () => setRefusal(ORGANIZATION_ERROR_COPY.failed)
  });

  const organization = subject.organization;
  const canEdit = subject.view.canStart;

  return (
    <>
      <Auth.Header
        title="Account details"
        description={
          organization
            ? "Confirm your organization's details before verifying it. They can't be changed once verification starts."
            : "Confirm your details before verifying your identity. They can't be changed once verification starts."
        }
      >
        <Auth.StepIndicator>{stepCountOf('profile')}</Auth.StepIndicator>
      </Auth.Header>

      {refusal ? (
        <Callout variant="warning" role="alert">
          {refusal}
        </Callout>
      ) : null}

      {organization ? (
        canEdit ? (
          <OrganizationDetailsForm
            key={subject.id}
            submitLabel="Continue"
            isPending={update.isPending}
            defaultValues={{
              name: organization.name,
              countryOfIncorporation: organization.countryOfIncorporation ?? '',
              title: organization.title ?? ''
            }}
            onSubmit={(details) => {
              setRefusal(null);
              // Nothing changed: on to the next step, without spending a write (it shares the organization's limit).
              const unchanged =
                details.name === organization.name &&
                details.countryOfIncorporation === (organization.countryOfIncorporation ?? '') &&
                (details.title ?? '') === (organization.title ?? '');
              if (unchanged) return proceed();
              update.mutate({ organizationId: subject.id, details });
            }}
          />
        ) : (
          <ReadOnlyDetails onContinue={proceed}>
            <LockedField label="Legal Name" value={organization.name} />
            <LockedField
              label="Country Of Incorporation"
              value={organization.countryOfIncorporation ? getCountryLabel(organization.countryOfIncorporation) : '-'}
            />
          </ReadOnlyDetails>
        )
      ) : canEdit ? (
        <PersonalDetailsForm key={subject.id} profile={profile} onSaved={proceed} onRefused={() => router.refresh()} />
      ) : (
        <ReadOnlyDetails onContinue={proceed}>
          <LockedField label="Name" value={`${profile.firstName} ${profile.lastName}`} />
          <LockedField label="Email" value={profile.email} type="email" />
        </ReadOnlyDetails>
      )}
    </>
  );
}

function ReadOnlyDetails({ children, onContinue }: { children: React.ReactNode; onContinue: () => void }) {
  return (
    <div className="flex flex-col gap-11">
      <div className="flex flex-col gap-7">{children}</div>
      <Button fullWidth onPress={onContinue}>
        Continue
      </Button>
    </div>
  );
}
