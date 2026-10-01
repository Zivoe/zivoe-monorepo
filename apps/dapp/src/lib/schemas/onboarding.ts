import { z } from 'zod';

import {
  accountTypeValues,
  howFoundZivoeValues,
  individualAmountValues,
  orgAmountValues
} from '@zivoe/database/onboarding';

import { COUNTRIES } from '@/types/countries';

export { accountTypeValues } from '@zivoe/database/onboarding';

const individualAmountEnum = z.enum(individualAmountValues, {
  required_error: 'Please select an amount of interest'
});

const orgAmountEnum = z.enum(orgAmountValues, {
  required_error: 'Please select an amount of interest'
});
const howFoundZivoeEnum = z.enum(howFoundZivoeValues, {
  required_error: 'Please select how you found Zivoe'
});

export type AccountType = (typeof accountTypeValues)[number];

// Account type form schema
export const accountTypeSchema = z.object({
  accountType: z.enum(accountTypeValues, {
    required_error: 'Please select an account type'
  })
});
export type AccountTypeFormData = z.infer<typeof accountTypeSchema>;

export const individualSchema = z.object({
  firstName: z.string({ required_error: 'First name is required' }).min(1, 'First name is required'),
  lastName: z.string({ required_error: 'Last name is required' }).min(1, 'Last name is required'),
  countryOfResidence: z.string({ required_error: 'Please select a country' }).min(1, 'Please select a country'),
  amountOfInterest: individualAmountEnum,
  howFoundZivoe: howFoundZivoeEnum
});
export type IndividualFormData = z.infer<typeof individualSchema>;

// Organization Step 1: Personal Information
export const orgPersonalInfoSchema = z.object({
  firstName: z.string({ required_error: 'First name is required' }).min(1, 'First name is required'),
  lastName: z.string({ required_error: 'Last name is required' }).min(1, 'Last name is required'),
  jobTitle: z.string({ required_error: 'Job title is required' }).min(1, 'Job title is required'),
  howFoundZivoe: howFoundZivoeEnum
});
export type OrgPersonalInfoFormData = z.infer<typeof orgPersonalInfoSchema>;

// Organization Step 2: Entity Information
export const orgEntityInfoSchema = z.object({
  entityName: z.string({ required_error: 'Entity name is required' }).min(1, 'Entity name is required'),
  countryOfIncorporation: z.string({ required_error: 'Please select a country' }).min(1, 'Please select a country'),
  amountOfInterest: orgAmountEnum
});
export type OrgEntityInfoFormData = z.infer<typeof orgEntityInfoSchema>;

// Combined organization schema (for server-side validation)
export const organizationSchema = orgPersonalInfoSchema.merge(orgEntityInfoSchema);
export type OrganizationFormData = z.infer<typeof organizationSchema>;

// Discriminated union for server action
export const onboardingSchema = z.discriminatedUnion('accountType', [
  z.object({ accountType: z.literal(accountTypeValues[0]) }).merge(individualSchema),
  z.object({ accountType: z.literal(accountTypeValues[1]) }).merge(organizationSchema)
]);
export type OnboardingFormData = z.infer<typeof onboardingSchema>;

/** Persona prefills the inquiry from these, so a name is trimmed and bounded. */
const MAX_NAME_LENGTH = 100;

/**
 * The Investor Profile step of `/verification`: the onboarding answers an
 * individual confirms or corrects before the Persona flow. The email is not
 * here on purpose — it is the sign-in identity and stays locked.
 */
export const investorProfileSchema = z.object({
  firstName: z
    .string({ required_error: 'First name is required' })
    .trim()
    .min(1, 'First name is required')
    .max(MAX_NAME_LENGTH, 'First name is too long'),
  lastName: z
    .string({ required_error: 'Last name is required' })
    .trim()
    .min(1, 'Last name is required')
    .max(MAX_NAME_LENGTH, 'Last name is too long'),
  // One of the select's own options: anything else has no ISO code to prefill.
  countryOfResidence: z
    .string({ required_error: 'Please select a country' })
    .refine((value) => COUNTRIES.some((country) => country.value === value), 'Please select a country')
});
export type InvestorProfileFormData = z.infer<typeof investorProfileSchema>;
