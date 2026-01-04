'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@zivoe/ui/core/button';
import { FieldError } from '@zivoe/ui/core/field/field-error';
import { Label } from '@zivoe/ui/core/field/label';
import { Input } from '@zivoe/ui/core/input';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectValue } from '@zivoe/ui/core/select';
import { toast } from '@zivoe/ui/core/sonner';

import { COUNTRIES } from '@/types/countries';

import { completeOnboarding } from '@/server/actions/onboarding';

import {
  type OnboardingFormData,
  type OrgEntityInfoFormData,
  type OrgPersonalInfoFormData,
  accountTypeValues,
  orgEntityInfoSchema,
  orgPersonalInfoSchema
} from '@/lib/schemas/onboarding';
import { AppError, onTxError } from '@/lib/utils';

import { AMOUNT_OF_INTEREST_OPTIONS, HOW_FOUND_ZIVOE_OPTIONS } from '@/app/(auth)/onboarding/_utils/onboarding.types';

import { Auth } from '../../_components/common';

const amountOfInterestItems = Object.entries(AMOUNT_OF_INTEREST_OPTIONS).map(([value, label]) => ({
  value,
  label
}));

const howFoundZivoeItems = Object.entries(HOW_FOUND_ZIVOE_OPTIONS).map(([value, label]) => ({
  value,
  label
}));

type Step = 'PERSONAL' | 'ENTITY';

export default function OrganizationForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('PERSONAL');
  const [personalInfo, setPersonalInfo] = useState<OrgPersonalInfoFormData | null>(null);

  const handlePersonalSuccess = (data: OrgPersonalInfoFormData) => {
    setPersonalInfo(data);
    setStep('ENTITY');
  };

  if (step === 'PERSONAL')
    return <PersonalInfoForm onBack={onBack} onSuccess={handlePersonalSuccess} personalInfo={personalInfo} />;

  if (step === 'ENTITY' && personalInfo)
    return <EntityInfoForm personalInfo={personalInfo} onBack={() => setStep('PERSONAL')} />;

  return null;
}

function PersonalInfoForm({
  onBack,
  onSuccess,
  personalInfo
}: {
  onBack: () => void;
  onSuccess: (data: OrgPersonalInfoFormData) => void;
  personalInfo: OrgPersonalInfoFormData | null;
}) {
  const { control, handleSubmit } = useForm<OrgPersonalInfoFormData>({
    resolver: zodResolver(orgPersonalInfoSchema),
    defaultValues: {
      firstName: personalInfo?.firstName ?? '',
      lastName: personalInfo?.lastName ?? '',
      jobTitle: personalInfo?.jobTitle ?? '',
      howFoundZivoe: personalInfo?.howFoundZivoe ?? undefined
    }
  });

  return (
    <>
      <Auth.Header title="Your Information" description="Tell us about the person managing this account.">
        <Auth.StepIndicator onBack={onBack}>Step 2 of 3</Auth.StepIndicator>
      </Auth.Header>

      <form onSubmit={handleSubmit(onSuccess)} className="flex flex-col gap-11">
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
                  isInvalid={invalid}
                  errorMessage={error?.message}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-7">
            <Controller
              control={control}
              name="jobTitle"
              render={({ field, fieldState: { error, invalid } }) => (
                <Input
                  {...field}
                  label="Job Title"
                  placeholder="e.g., CEO, Investment Manager"
                  isInvalid={invalid}
                  errorMessage={error?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="howFoundZivoe"
              render={({ field, fieldState: { error, invalid } }) => (
                <div className="flex flex-col gap-3">
                  <Label>How'd You Find Zivoe?</Label>

                  <Select
                    placeholder="Select"
                    aria-label="How did you find Zivoe"
                    value={field.value}
                    onChange={field.onChange}
                    isInvalid={!!error}
                    className="flex flex-col gap-3"
                  >
                    <Auth.SelectTrigger isInvalid={invalid}>
                      <SelectValue />
                    </Auth.SelectTrigger>

                    <FieldError>{error?.message}</FieldError>

                    <SelectPopover>
                      <SelectListBox items={howFoundZivoeItems}>
                        {(item) => <SelectItem id={item.value}>{item.label}</SelectItem>}
                      </SelectListBox>
                    </SelectPopover>
                  </Select>
                </div>
              )}
            />
          </div>
        </div>

        <Button type="submit" fullWidth>
          Continue
        </Button>
      </form>
    </>
  );
}

interface EntityInfoFormProps {
  personalInfo: OrgPersonalInfoFormData;
  onBack: () => void;
}

function EntityInfoForm({ personalInfo, onBack }: EntityInfoFormProps) {
  const { control, handleSubmit } = useForm<OrgEntityInfoFormData>({
    resolver: zodResolver(orgEntityInfoSchema),
    defaultValues: {
      entityName: '',
      countryOfIncorporation: ''
    }
  });

  const onboarding = useCompleteOnboarding();

  const onSubmit = (data: OrgEntityInfoFormData) => {
    onboarding.mutate({
      accountType: accountTypeValues[1],
      ...personalInfo,
      ...data
    });
  };

  return (
    <>
      <Auth.Header title="Organization Details" description="Tell us about your organization.">
        <Auth.StepIndicator onBack={onBack}>Step 3 of 3</Auth.StepIndicator>
      </Auth.Header>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-11">
        <div className="flex flex-col gap-7">
          <Controller
            control={control}
            name="entityName"
            render={({ field, fieldState: { error, invalid } }) => (
              <Input
                {...field}
                label="Entity Name"
                placeholder="Legal name of your organization"
                isInvalid={invalid}
                errorMessage={error?.message}
              />
            )}
          />

          <div className="grid grid-cols-2 gap-7">
            <Controller
              control={control}
              name="countryOfIncorporation"
              render={({ field, fieldState: { error, invalid } }) => (
                <div className="flex flex-col gap-3">
                  <Label>Country Of Incorporation</Label>

                  <Select
                    placeholder="Select"
                    aria-label="Country of Incorporation"
                    value={field.value}
                    onChange={field.onChange}
                    isInvalid={!!error}
                    className="flex flex-col gap-3"
                  >
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

                    <SelectPopover shouldFlip={false}>
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
                </div>
              )}
            />

            <Controller
              control={control}
              name="amountOfInterest"
              render={({ field, fieldState: { error, invalid } }) => (
                <div className="flex flex-col gap-3">
                  <Label>Amount Of Interest</Label>

                  <Select
                    placeholder="Select"
                    aria-label="Amount of Interest"
                    value={field.value}
                    onChange={field.onChange}
                    isInvalid={!!error}
                    className="flex flex-col gap-3"
                  >
                    <Auth.SelectTrigger isInvalid={invalid}>
                      <SelectValue />
                    </Auth.SelectTrigger>

                    <FieldError>{error?.message}</FieldError>

                    <SelectPopover>
                      <SelectListBox items={amountOfInterestItems}>
                        {(item) => <SelectItem id={item.value}>{item.label}</SelectItem>}
                      </SelectListBox>
                    </SelectPopover>
                  </Select>
                </div>
              )}
            />
          </div>
        </div>

        <Button type="submit" fullWidth isPending={onboarding.isPending} pendingContent="Completing...">
          Continue
        </Button>
      </form>
    </>
  );
}

function useCompleteOnboarding() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: OnboardingFormData) => {
      const { error } = await completeOnboarding(data);
      if (error) throw new AppError({ message: 'Onboarding failed', exception: error, capture: false });
    },

    onSuccess: () => {
      toast({
        type: 'success',
        title: 'Welcome to Zivoe!',
        description: 'Your account has been set up successfully.'
      });

      router.push('/');
    },

    onError: (err) => {
      onTxError({
        err,
        defaultToastMsg: 'An unexpected error occurred. Please try again.',
        sentry: { flow: 'onboarding', extras: {} }
      });
    }
  });
}
