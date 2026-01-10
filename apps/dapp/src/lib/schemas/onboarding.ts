import { z } from 'zod';

import { amountOfInterestValues, howFoundZivoeValues } from '@/server/db/schema';

const amountOfInterestEnum = z.enum(amountOfInterestValues, {
  required_error: 'Please select an amount of interest'
});
const howFoundZivoeEnum = z.enum(howFoundZivoeValues, {
  required_error: 'Please select how you found Zivoe'
});

// Account type values - single source of truth
export const accountTypeValues = ['individual', 'organization'] as const;
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
  amountOfInterest: amountOfInterestEnum,
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
  amountOfInterest: amountOfInterestEnum
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
