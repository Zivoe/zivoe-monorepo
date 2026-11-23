'use client';

import { type ReactNode, useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';

import { type OrganizationDetailsFormData, organizationDetailsSchema } from '@/lib/schemas/organizations';

import { CountryComboBox } from '@/components/country-combo-box';

/**
 * The organization's three questions, the same wherever they are asked: in
 * onboarding, in the "Create organization" dialog and in `/verification`'s
 * account details. `key` it by the organization so another one's values never linger.
 */
export function OrganizationDetailsForm({
  defaultValues,
  submitLabel,
  isPending,
  onSubmit,
  onValuesChange,
  before
}: {
  defaultValues?: Partial<OrganizationDetailsFormData>;
  /** Every edit, valid or not: onboarding keeps them for its way back. */
  onValuesChange?: (values: Partial<OrganizationDetailsFormData>) => void;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (data: OrganizationDetailsFormData) => void;
  /** Shown above the fields, inside the form. */
  before?: ReactNode;
}) {
  const { control, handleSubmit, watch } = useForm<OrganizationDetailsFormData>({
    resolver: zodResolver(organizationDetailsSchema),
    defaultValues: { name: '', countryOfIncorporation: '', title: '', ...defaultValues }
  });

  useEffect(() => {
    if (!onValuesChange) return;
    const subscription = watch((values) => onValuesChange(values));
    return () => subscription.unsubscribe();
  }, [watch, onValuesChange]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-11">
      <div className="flex flex-col gap-7">
        {before}

        <Controller
          control={control}
          name="name"
          render={({ field, fieldState: { error, invalid } }) => (
            <Input
              {...field}
              label="Legal Name"
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

        <Controller
          control={control}
          name="title"
          render={({ field, fieldState: { error, invalid } }) => (
            <Input
              {...field}
              label="Your Job Title"
              placeholder="CEO"
              autoComplete="organization-title"
              isInvalid={invalid}
              errorMessage={error?.message}
            />
          )}
        />
      </div>

      <Button type="submit" fullWidth isPending={isPending} pendingContent="Saving...">
        {submitLabel}
      </Button>
    </form>
  );
}
