'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@zivoe/ui/core/button';
import { Radio, RadioGroup } from '@zivoe/ui/core/radio';

import {
  type AccountType,
  type AccountTypeFormData,
  accountTypeSchema,
  accountTypeValues
} from '@/lib/schemas/onboarding';

import { Auth } from '../../_components/common';

export default function AccountTypeForm({ onSubmit }: { onSubmit: (accountType: AccountType) => void }) {
  const { control, handleSubmit } = useForm<AccountTypeFormData>({
    resolver: zodResolver(accountTypeSchema)
  });

  const handleFormSubmit = (data: AccountTypeFormData) => {
    onSubmit(data.accountType);
  };

  return (
    <>
      <Auth.Header
        title="Select Account Type"
        description="Are you registering as an individual or on behalf of an organization?"
      >
        <Auth.StepIndicator>Step 1</Auth.StepIndicator>
      </Auth.Header>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-11">
        <Controller
          control={control}
          name="accountType"
          render={({ field, fieldState: { error, invalid } }) => (
            <RadioGroup isInvalid={invalid} errorMessage={error?.message} {...field}>
              {ACCOUNT_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <Radio key={option.value} variant="card" value={option.value}>
                    <Icon className="size-6 text-brand" />
                    <span>{option.label}</span>
                  </Radio>
                );
              })}
            </RadioGroup>
          )}
        />

        <Button type="submit" fullWidth>
          Continue
        </Button>
      </form>
    </>
  );
}

// Person/User icon based on Figma design
function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
      <path d="M6 21v-2c0-2.21 1.79-4 4-4h4c2.21 0 4 1.79 4 4v2" />
    </svg>
  );
}

// Building/Shop icon based on Figma design
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
      <path d="M9 18v.01" />
    </svg>
  );
}

const ACCOUNT_TYPE_OPTIONS = [
  {
    value: accountTypeValues[0],
    label: 'Individual',
    icon: UserIcon
  },
  {
    value: accountTypeValues[1],
    label: 'Organization',
    icon: BuildingIcon
  }
];
