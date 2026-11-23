'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@zivoe/ui/core/button';
import { FieldError } from '@zivoe/ui/core/field/field-error';
import { Label } from '@zivoe/ui/core/field/label';
import { Input } from '@zivoe/ui/core/input';
import { Radio, RadioGroup } from '@zivoe/ui/core/radio';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectValue } from '@zivoe/ui/core/select';

import { AMOUNT_OF_INTEREST_OPTIONS, HOW_FOUND_ZIVOE_OPTIONS } from '@/lib/onboarding-options';
import { type OnboardingFormData, onboardingSchema } from '@/lib/schemas/onboarding';
import { type OrganizationDetailsFormData } from '@/lib/schemas/organizations';

import { CountryComboBox } from '@/components/country-combo-box';
import { InviteTeamForm } from '@/components/invite-team-form';
import { OrganizationDetailsForm } from '@/components/organization-details-form';

import { Auth } from '../../_components/common';
import { useCompleteOnboarding, useLeaveOnboarding } from '../_hooks/useCompleteOnboarding';

const amountOfInterestItems = Object.entries(AMOUNT_OF_INTEREST_OPTIONS).map(([value, label]) => ({ value, label }));
const howFoundZivoeItems = Object.entries(HOW_FOUND_ZIVOE_OPTIONS).map(([value, label]) => ({ value, label }));

type Step = 'profile' | 'invest' | 'organization' | 'invite';
type Choice = 'me' | 'organization';

/**
 * Onboarding, after the terms, as one multi-step form: the person's answers, then how they will invest and,
 * through an organization, its details. Nothing is saved until the last of those: one write keeps the profile
 * and the organization together. The invite step comes after that write, and is in the URL (`?step=invite`),
 * so a reload or a re-render there shows it again for the organization just made, never a second one. Without `canInvestThroughOrganization`
 * (an invitation waiting in `next`) onboarding is the first step alone.
 */
export default function OnboardingForm({
  next,
  canInvestThroughOrganization,
  inviteTo
}: {
  next?: string;
  canInvestThroughOrganization: boolean;
  /** Onboarded already, on `?step=invite`: straight to the invite step for this organization. */
  inviteTo?: { id: string; name: string };
}) {
  const [step, setStep] = useState<Step>(inviteTo ? 'invite' : 'profile');
  const [profile, setProfile] = useState<OnboardingFormData>();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [organization, setOrganization] = useState<{ id: string; name: string } | null>(inviteTo ?? null);
  const [organizationName, setOrganizationName] = useState('');

  const leave = useLeaveOnboarding({ next });
  const onboarding = useCompleteOnboarding({
    next,
    onOrganizationCreated: (id) => {
      setOrganization({ id, name: organizationName });
      setStep('invite');
    }
  });

  return (
    <>
      <Auth.Container>
        {step === 'profile' ? (
          <ProfileStep
            defaultValues={profile}
            isPending={onboarding.isPending}
            onSubmit={(data) => {
              setProfile(data);
              if (canInvestThroughOrganization) setStep('invest');
              else onboarding.mutate({ profile: data });
            }}
          />
        ) : null}

        {step === 'invest' && profile ? (
          <>
            <Auth.Header
              title="How Will You Invest?"
              description="You can invest yourself, through an organization, or both. You can add an organization at any time."
            >
              <Auth.StepIndicator onBack={() => setStep('profile')} />
            </Auth.Header>

            <RadioGroup
              aria-label="How you will invest"
              value={choice}
              onChange={(value) => setChoice(value === 'organization' ? 'organization' : 'me')}
            >
              <Radio variant="card" value="me">
                Just me
              </Radio>
              <Radio variant="card" value="organization">
                Through an organization
              </Radio>
            </RadioGroup>

            <Button
              fullWidth
              isDisabled={!choice}
              isPending={onboarding.isPending}
              pendingContent="Onboarding..."
              onPress={() => {
                if (choice === 'organization') setStep('organization');
                else onboarding.mutate({ profile });
              }}
            >
              Continue
            </Button>
          </>
        ) : null}

        {step === 'organization' && profile ? (
          <>
            <Auth.Header
              title="About Your Organization"
              description="The organization's legal name and country, as they appear on its registration documents."
            >
              <Auth.StepIndicator onBack={() => setStep('invest')} />
            </Auth.Header>

            <OrganizationDetailsForm
              submitLabel="Continue"
              isPending={onboarding.isPending}
              onSubmit={(details: OrganizationDetailsFormData) => {
                // Before the save: if the page renders again while it runs, it renders the invite step.
                const url = new URL(window.location.href);
                url.searchParams.set('step', 'invite');
                window.history.replaceState(null, '', url);
                setOrganizationName(details.name);
                onboarding.mutate({ profile, organization: details });
              }}
            />
          </>
        ) : null}

        {step === 'invite' && organization ? (
          <>
            <Auth.Header
              title="Will Anyone Else Be Joining You?"
              description={`Invite the colleagues who will act for ${organization.name} with you. You can also invite them later from Settings.`}
            />

            <InviteTeamForm organizationId={organization.id} submitLabel="Continue" onDone={leave}>
              <Button variant="ghost-light" fullWidth onPress={leave}>
                Skip for now
              </Button>
            </InviteTeamForm>
          </>
        ) : null}
      </Auth.Container>

      <Auth.HelpFooter />
    </>
  );
}

/** Step one, for everyone: the person's own answers. Kept when they step back from a later step. */
function ProfileStep({
  defaultValues,
  isPending,
  onSubmit
}: {
  defaultValues?: OnboardingFormData;
  isPending: boolean;
  onSubmit: (data: OnboardingFormData) => void;
}) {
  const { control, handleSubmit } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues
  });

  return (
    <>
      <Auth.Header title="Tell Us About Yourself" description="Please fill out the fields below." />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-11">
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

                    <SelectPopover matchTriggerWidth>
                      <SelectListBox items={amountOfInterestItems}>
                        {(item) => <SelectItem id={item.value}>{item.label}</SelectItem>}
                      </SelectListBox>
                    </SelectPopover>
                  </Select>
                </div>
              )}
            />
          </div>

          <Controller
            control={control}
            name="howFoundZivoe"
            render={({ field, fieldState: { error, invalid } }) => (
              <div className="flex flex-col gap-3">
                <Label>How&apos;d You Find Zivoe?</Label>

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

                  <SelectPopover matchTriggerWidth>
                    <SelectListBox items={howFoundZivoeItems}>
                      {(item) => <SelectItem id={item.value}>{item.label}</SelectItem>}
                    </SelectListBox>
                  </SelectPopover>
                </Select>
              </div>
            )}
          />
        </div>

        <Button type="submit" fullWidth isPending={isPending} pendingContent="Onboarding...">
          Continue
        </Button>
      </form>
    </>
  );
}
