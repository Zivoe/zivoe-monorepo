'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';
import { LockIcon } from '@zivoe/ui/icons';

import { updateInvestorProfile } from '@/server/actions/investor-profile';
import { type InvestorProfile } from '@/server/data/investor-profile';

import { type InvestorProfileFormData, investorProfileSchema } from '@/lib/schemas/onboarding';
import { AppError, onTxError } from '@/lib/utils';

import { CountryComboBox } from '@/components/country-combo-box';

/**
 * A person's own details, prefilled, to confirm or correct before the Persona
 * flow. The email is shown locked: it is the sign-in identity. A refused save
 * calls `onRefused`, which re-reads the record: a verification begun elsewhere
 * moves the page on instead of leaving a form that can never save.
 */
export function PersonalDetailsForm({
  profile,
  onSaved,
  onRefused
}: {
  profile: InvestorProfile;
  onSaved: () => void;
  onRefused: () => void;
}) {
  const { control, handleSubmit } = useForm<InvestorProfileFormData>({
    resolver: zodResolver(investorProfileSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      countryOfResidence: profile.countryOfResidence ?? ''
    }
  });

  const save = useMutation({
    mutationFn: async (data: InvestorProfileFormData) => {
      const { error } = await updateInvestorProfile(data);
      if (error) throw new AppError({ message: 'Could not save your details.', exception: error, capture: false });
    },
    onSuccess: onSaved,
    onError: (err) => {
      onRefused();
      onTxError({
        err,
        defaultToastMsg: 'An unexpected error occurred. Please try again.',
        sentry: { flow: 'investor-profile', extras: {} }
      });
    }
  });

  return (
    <form onSubmit={handleSubmit((data) => save.mutate(data))} className="flex flex-col gap-11">
      <div className="flex flex-col gap-7">
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
  );
}

/** A value shown in the form's own field style, read-only and marked with a lock. */
export function LockedField({ label, value, type }: { label: string; value: string; type?: 'email' }) {
  return <Input label={label} value={value} type={type} isReadOnly endContent={<LockIcon aria-hidden="true" />} />;
}
