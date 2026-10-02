'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@zivoe/ui/core/button';
import { FieldError } from '@zivoe/ui/core/field/field-error';
import { Label } from '@zivoe/ui/core/field/label';
import { Input } from '@zivoe/ui/core/input';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectValue } from '@zivoe/ui/core/select';
import { LockIcon } from '@zivoe/ui/icons';

import { COUNTRIES } from '@/types/countries';

import { updateInvestorProfile } from '@/server/actions/investor-profile';
import { type InvestorProfile } from '@/server/data/investor-profile';
import { type KycStatusView as KycStatusViewModel } from '@/server/kyc/kyc-status';

import { type InvestorProfileFormData, investorProfileSchema } from '@/lib/schemas/onboarding';
import { AppError, onTxError } from '@/lib/utils';

import { Auth } from '@/app/(auth)/_components/common';

import { KycStatusView } from './kyc-status-view';

const ACCOUNT_TYPE_LABELS: Record<InvestorProfile['accountType'], string> = {
  individual: 'Individual',
  organization: 'Organization'
};

/**
 * Step 1 of `/verification`: the onboarding answers, prefilled, for the
 * investor to confirm or correct before the Persona flow. The account type
 * and the email are shown locked — the first is a decision onboarding made,
 * the second the sign-in identity. An individual saves and moves on; an
 * organization sees the step locked, with the team as the way forward, since
 * entity verification is not this flow.
 */
export function InvestorProfileStep({
  profile,
  view,
  onSaved
}: {
  profile: InvestorProfile;
  view: KycStatusViewModel;
  onSaved: (profile: InvestorProfile) => void;
}) {
  if (profile.accountType === 'organization') {
    return (
      <>
        <Auth.Header title="Investor profile" description="Your account is registered as an organization.">
          <Auth.StepIndicator>Step 1 of 2</Auth.StepIndicator>
        </Auth.Header>

        <div className="flex flex-col gap-7">
          <LockedField label="Account type" value={ACCOUNT_TYPE_LABELS[profile.accountType]} />
          <KycStatusView view={view} />
        </div>
      </>
    );
  }

  return <IndividualProfileForm profile={profile} onSaved={onSaved} />;
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

  const router = useRouter();
  const save = useMutation({
    mutationFn: async (data: InvestorProfileFormData) => {
      const { error } = await updateInvestorProfile(data);
      if (error) throw new AppError({ message: 'Could not save your details.', exception: error, capture: false });
      return data;
    },
    onSuccess: (data) => onSaved({ ...profile, ...data }),
    onError: (err) => {
      // Re-read the record: a save refused because a verification began
      // elsewhere (another tab, another device) moves the page to that step
      // instead of leaving a form that can never save.
      router.refresh();
      onTxError({
        err,
        defaultToastMsg: 'An unexpected error occurred. Please try again.',
        sentry: { flow: 'investor-profile', extras: {} }
      });
    }
  });

  return (
    <>
      <Auth.Header
        title="Investor profile"
        description="Confirm the details we will verify you against. They are filled in from your onboarding answers."
      >
        <Auth.StepIndicator>Step 1 of 2</Auth.StepIndicator>
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
                <Select
                  placeholder="Select"
                  value={field.value}
                  onChange={field.onChange}
                  isInvalid={!!error}
                  className="flex flex-col gap-3"
                >
                  {/* Inside the Select, so it names the trigger and a click on it focuses it. */}
                  <Label>Country Of Residence</Label>

                  <Auth.SelectTrigger isInvalid={invalid}>
                    <SelectValue>
                      {({ selectedText, isPlaceholder }) => {
                        if (isPlaceholder) return 'Select';

                        const selected = COUNTRIES.find((c) => c.value === field.value);
                        return selected ? (
                          <span className="flex items-center gap-2">
                            <span className="text-regular">{selected.flag}</span>
                            <span>{selectedText}</span>
                          </span>
                        ) : (
                          selectedText
                        );
                      }}
                    </SelectValue>
                  </Auth.SelectTrigger>

                  <FieldError>{error?.message}</FieldError>

                  <SelectPopover matchTriggerWidth>
                    <SelectListBox items={COUNTRIES}>
                      {(item) => (
                        <SelectItem id={item.value} textValue={item.label}>
                          <span className="flex items-center gap-2">
                            <span className="text-regular">{item.flag}</span>
                            <span>{item.label}</span>
                          </span>
                        </SelectItem>
                      )}
                    </SelectListBox>
                  </SelectPopover>
                </Select>
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
