'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';
import { LockIcon } from '@zivoe/ui/icons';

import { updateInvestorProfile } from '@/server/actions/investor-profile';
import { type InvestorProfile } from '@/server/data/investor-profile';
import { type VerificationStatusView as VerificationStatusViewModel } from '@/server/verification/verification-status';

import {
  type InvestorProfileFormData,
  type OrganizationProfileFormData,
  investorProfileSchema,
  organizationProfileSchema
} from '@/lib/schemas/onboarding';
import { AppError, onTxError } from '@/lib/utils';

import { CountryComboBox } from '@/components/country-combo-box';

import { Auth } from '@/app/(auth)/_components/common';

import { VerificationStatusView } from './verification-status-view';

const ACCOUNT_TYPE_LABELS: Record<InvestorProfile['accountType'], string> = {
  individual: 'Individual',
  organization: 'Organization'
};

/**
 * Step 1 of `/verification`: the onboarding answers, prefilled, for the
 * investor to confirm or correct before the Persona flow. The account type
 * and the email are shown locked — the first is a decision onboarding made,
 * the second the sign-in identity. An individual confirms the person, an
 * organization the entity and the person filling the form in, and either
 * saves and moves on. An organization whose flow is not yet configured sees
 * the step locked instead, with the team as the way forward.
 */
export function InvestorProfileStep({
  profile,
  view,
  onSaved
}: {
  profile: InvestorProfile;
  view: VerificationStatusViewModel;
  onSaved: (profile: InvestorProfile) => void;
}) {
  if (profile.accountType === 'organization' && view.canStart) {
    return <OrganizationProfileForm profile={profile} onSaved={onSaved} />;
  }

  if (profile.accountType === 'organization') {
    return (
      <>
        <Auth.Header title="Investor profile" description="Your account is registered as an organization.">
          <Auth.StepIndicator>Step 1 of 3</Auth.StepIndicator>
        </Auth.Header>

        <div className="flex flex-col gap-7">
          <LockedField label="Account type" value={ACCOUNT_TYPE_LABELS[profile.accountType]} />
          <VerificationStatusView view={view} />
        </div>
      </>
    );
  }

  return <IndividualProfileForm profile={profile} onSaved={onSaved} />;
}

/**
 * The save both forms share: the action, then the saved values back to the
 * flow. A refused save re-reads the record first — a verification begun
 * elsewhere (another tab, another device) moves the page to that step
 * instead of leaving a form that can never save.
 */
function useSaveProfile<T extends InvestorProfileFormData | OrganizationProfileFormData>({
  profile,
  onSaved
}: {
  profile: InvestorProfile;
  onSaved: (profile: InvestorProfile) => void;
}) {
  const router = useRouter();
  return useMutation({
    mutationFn: async (data: T) => {
      const { error } = await updateInvestorProfile(data);
      if (error) throw new AppError({ message: 'Could not save your details.', exception: error, capture: false });
      return data;
    },
    onSuccess: (data) => onSaved({ ...profile, ...data }),
    onError: (err) => {
      router.refresh();
      onTxError({
        err,
        defaultToastMsg: 'An unexpected error occurred. Please try again.',
        sentry: { flow: 'investor-profile', extras: {} }
      });
    }
  });
}

function OrganizationProfileForm({
  profile,
  onSaved
}: {
  profile: InvestorProfile;
  onSaved: (profile: InvestorProfile) => void;
}) {
  const { control, handleSubmit } = useForm<OrganizationProfileFormData>({
    resolver: zodResolver(organizationProfileSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      jobTitle: profile.jobTitle ?? '',
      entityName: profile.entityName ?? '',
      countryOfIncorporation: profile.countryOfIncorporation ?? ''
    }
  });

  const save = useSaveProfile<OrganizationProfileFormData>({ profile, onSaved });

  return (
    <>
      <Auth.Header
        title="Investor profile"
        description="Confirm the organization we will verify and your own details. They are filled in from your onboarding answers."
      >
        <Auth.StepIndicator>Step 1 of 3</Auth.StepIndicator>
      </Auth.Header>

      <form onSubmit={handleSubmit((data) => save.mutate(data))} className="flex flex-col gap-11">
        <div className="flex flex-col gap-7">
          <LockedField label="Account type" value={ACCOUNT_TYPE_LABELS[profile.accountType]} />

          <Controller
            control={control}
            name="entityName"
            render={({ field, fieldState: { error, invalid } }) => (
              <Input
                {...field}
                label="Entity Name"
                placeholder="Legal name of your organization"
                autoComplete="organization"
                isInvalid={invalid}
                errorMessage={error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="countryOfIncorporation"
            render={({ field, fieldState: { error, invalid } }) => (
              <CountryComboBox
                label="Country Of Incorporation"
                value={field.value}
                onChange={field.onChange}
                isInvalid={invalid}
                errorMessage={error?.message}
              />
            )}
          />

          <div className="grid grid-cols-2 gap-7">
            <Controller
              control={control}
              name="firstName"
              render={({ field, fieldState: { error, invalid } }) => (
                <Input
                  {...field}
                  label="First Name"
                  placeholder="Johnny"
                  autoComplete="given-name"
                  isInvalid={invalid}
                  errorMessage={error?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="lastName"
              render={({ field, fieldState: { error, invalid } }) => (
                <Input
                  {...field}
                  label="Last Name"
                  placeholder="Appleseed"
                  autoComplete="family-name"
                  isInvalid={invalid}
                  errorMessage={error?.message}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
            <Controller
              control={control}
              name="jobTitle"
              render={({ field, fieldState: { error, invalid } }) => (
                <Input
                  {...field}
                  label="Job Title"
                  placeholder="Managing Partner"
                  autoComplete="organization-title"
                  isInvalid={invalid}
                  errorMessage={error?.message}
                />
              )}
            />

            <LockedField label="Email" value={profile.email} type="email" />
          </div>
        </div>

        <Button type="submit" fullWidth isPending={save.isPending} pendingContent="Saving...">
          Continue
        </Button>
      </form>
    </>
  );
}

function IndividualProfileForm({
  profile,
  onSaved
}: {
  profile: InvestorProfile;
  onSaved: (profile: InvestorProfile) => void;
}) {
  const { control, handleSubmit } = useForm<InvestorProfileFormData>({
    resolver: zodResolver(investorProfileSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      countryOfResidence: profile.countryOfResidence ?? ''
    }
  });

  const save = useSaveProfile<InvestorProfileFormData>({ profile, onSaved });

  return (
    <>
      <Auth.Header
        title="Investor profile"
        description="Confirm the details we will verify you against. They are filled in from your onboarding answers."
      >
        <Auth.StepIndicator>Step 1 of 3</Auth.StepIndicator>
      </Auth.Header>

      <form onSubmit={handleSubmit((data) => save.mutate(data))} className="flex flex-col gap-11">
        <div className="flex flex-col gap-7">
          <LockedField label="Account type" value={ACCOUNT_TYPE_LABELS[profile.accountType]} />

          <div className="grid grid-cols-2 gap-7">
            <Controller
              control={control}
              name="firstName"
              render={({ field, fieldState: { error, invalid } }) => (
                <Input
                  {...field}
                  label="First Name"
                  placeholder="Johnny"
                  autoComplete="given-name"
                  isInvalid={invalid}
                  errorMessage={error?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="lastName"
              render={({ field, fieldState: { error, invalid } }) => (
                <Input
                  {...field}
                  label="Last Name"
                  placeholder="Appleseed"
                  autoComplete="family-name"
                  isInvalid={invalid}
                  errorMessage={error?.message}
                />
              )}
            />
          </div>

          {/* Stacked on phones: side by side, a country name and an email address are cut off. */}
          <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
            <Controller
              control={control}
              name="countryOfResidence"
              render={({ field, fieldState: { error, invalid } }) => (
                <CountryComboBox
                  label="Country Of Residence"
                  value={field.value}
                  onChange={field.onChange}
                  isInvalid={invalid}
                  errorMessage={error?.message}
                />
              )}
            />

            <LockedField label="Email" value={profile.email} type="email" />
          </div>
        </div>

        <Button type="submit" fullWidth isPending={save.isPending} pendingContent="Saving...">
          Continue
        </Button>
      </form>
    </>
  );
}

/** A value shown in the form's own field style, read-only and marked with a lock. */
function LockedField({ label, value, type }: { label: string; value: string; type?: 'email' }) {
  return <Input label={label} value={value} type={type} isReadOnly endContent={<LockIcon aria-hidden="true" />} />;
}
