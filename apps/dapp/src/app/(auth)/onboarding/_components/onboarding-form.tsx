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

import { AMOUNT_OF_INTEREST_OPTIONS, REFERRAL_SOURCE_OPTIONS } from '@/lib/onboarding-options';
import { type OnboardingFormData, onboardingSchema } from '@/lib/schemas/onboarding';
import { type OrganizationDetailsFormData } from '@/lib/schemas/organizations';

import { CountryComboBox } from '@/components/country-combo-box';
import { InviteTeamForm } from '@/components/invite-team-form';
import { OrganizationDetailsForm } from '@/components/organization-details-form';

import { Auth } from '../../_components/common';
import { useCompleteOnboarding, useLeaveOnboarding } from '../_hooks/useCompleteOnboarding';

const amountOfInterestItems = Object.entries(AMOUNT_OF_INTEREST_OPTIONS).map(([value, label]) => ({ value, label }));
const referralSourceItems = Object.entries(REFERRAL_SOURCE_OPTIONS).map(([value, label]) => ({ value, label }));

type Step = 'invest' | 'profile' | 'organization' | 'invite';
type Choice = 'me' | 'organization';

/**
 * Onboarding, after the terms, as one multi-step form: how they will invest, the person's own answers and,
 * through an organization, its details. Nothing is saved until the last of those: one write keeps the profile
 * and the organization together, and the server refuses either without the person's answers. The invite step
 * comes after that write, and is in the URL (`?step=invite`), so a reload or a re-render there shows it again
 * for the organization just made, never a second one. Without `canInvestThroughOrganization` (an invitation
 * waiting in `next`) onboarding is the person's answers alone. Answers typed on a step are kept when they step
 * back from it.
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
  const [step, setStep] = useState<Step>(inviteTo ? 'invite' : canInvestThroughOrganization ? 'invest' : 'profile');
  const [choice, setChoice] = useState<Choice | null>(null);
  // What the steps show again on the way back; `profile` is the validated answers the save sends.
  const [profileDraft, setProfileDraft] = useState<Partial<OnboardingFormData>>();
  const [profile, setProfile] = useState<OnboardingFormData>();
  const [organizationDraft, setOrganizationDraft] = useState<Partial<OrganizationDetailsFormData>>();
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
  // Saving until the page leaves: no way back and no second Continue, since a second save would race the first.
  const isSaving = onboarding.isPending || onboarding.isSuccess;

  return (
    <>
      <Auth.Container>
        {step === 'invest' ? (
          <>
            <Auth.Header
              title="How Will You Invest?"
              description="You can invest yourself, through an organization, or both. You can add an organization at any time."
            />

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

            <Button fullWidth isDisabled={!choice} onPress={() => setStep('profile')}>
              Continue
            </Button>
          </>
        ) : null}

        {step === 'profile' ? (
          <ProfileStep
            defaultValues={profileDraft}
            description={
              choice === 'organization'
                ? "First, about you. Your organization's details come next."
                : 'Please fill out the fields below.'
            }
            isSaving={isSaving}
            onBack={
              canInvestThroughOrganization
                ? (values) => {
                    setProfileDraft(values);
                    setStep('invest');
                  }
                : undefined
            }
            onSubmit={(data) => {
              setProfileDraft(data);
              setProfile(data);
              if (choice === 'organization') setStep('organization');
              else onboarding.mutate({ profile: data });
            }}
          />
        ) : null}

        {step === 'organization' && profile ? (
          <>
            <Auth.Header
              title="About Your Organization"
              description="The organization's legal name and country, as they appear on its registration documents."
            >
              <Auth.StepIndicator onBack={() => setStep('profile')} isBackDisabled={isSaving} />
            </Auth.Header>

            <OrganizationDetailsForm
              defaultValues={organizationDraft}
              onValuesChange={setOrganizationDraft}
              submitLabel="Continue"
              isPending={isSaving}
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

/**
 * The person's own answers, asked of everyone: after "How will you invest?", or alone for an invitee.
 * `onBack` hands up what was typed, valid or not, so it is there again on the way forward.
 */
function ProfileStep({
  defaultValues,
  description,
  isSaving,
  onBack,
  onSubmit
}: {
  defaultValues?: Partial<OnboardingFormData>;
  description: string;
  isSaving: boolean;
  onBack?: (values: Partial<OnboardingFormData>) => void;
  onSubmit: (data: OnboardingFormData) => void;
}) {
  const { control, getValues, handleSubmit } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues
  });

  return (
    <>
      <Auth.Header title="Tell Us About Yourself" description={description}>
        {onBack ? <Auth.StepIndicator onBack={() => onBack(getValues())} isBackDisabled={isSaving} /> : null}
      </Auth.Header>

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
            name="referralSource"
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
                    <SelectListBox items={referralSourceItems}>
                      {(item) => <SelectItem id={item.value}>{item.label}</SelectItem>}
                    </SelectListBox>
                  </SelectPopover>
                </Select>
              </div>
            )}
          />
        </div>

        <Button type="submit" fullWidth isPending={isSaving} pendingContent="Onboarding...">
          Continue
        </Button>
      </form>
    </>
  );
}
