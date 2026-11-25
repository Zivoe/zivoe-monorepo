'use client';

import { type ReactNode, useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';

import {
  type OrganizationDetailsFormData,
  organizationDetailsSchema,
  organizationFactsSchema
} from '@/lib/schemas/organizations';

import { CountryComboBox } from '@/components/country-combo-box';

/** Without the title: the facts, and the hidden title field's empty default passes, so the form keeps one shape. */
const factsOnlySchema = organizationFactsSchema.extend({ title: z.string() });

/**
 * The organization's questions, the same wherever they are asked: its legal name,
 * its country and, where it is created (onboarding and the "Create organization"
 * dialog), the creator's job title. `/verification`'s Account details passes
 * `withTitle={false}` and reads the two facts from what it submits. `key` it by the
 * organization so another one's values never linger.
 */
export function OrganizationDetailsForm({
  defaultValues,
  withTitle = true,
  submitLabel,
  isPending,
  onSubmit,
  onValuesChange,
  before
}: {
  defaultValues?: Partial<OrganizationDetailsFormData>;
  withTitle?: boolean;
  /** Every edit, valid or not: onboarding keeps them for its way back. */
  onValuesChange?: (values: Partial<OrganizationDetailsFormData>) => void;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (data: OrganizationDetailsFormData) => void;
  /** Shown above the fields, inside the form. */
  before?: ReactNode;
}) {
  const { control, handleSubmit, watch } = useForm<OrganizationDetailsFormData>({
    resolver: zodResolver(withTitle ? organizationDetailsSchema : factsOnlySchema),
    defaultValues: { name: '', countryOfIncorporation: '', ...defaultValues, title: defaultValues?.title ?? '' }
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

        {withTitle ? (
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
        ) : null}
      </div>

      <Button type="submit" fullWidth isPending={isPending} pendingContent="Saving...">
        {submitLabel}
      </Button>
    </form>
  );
}
