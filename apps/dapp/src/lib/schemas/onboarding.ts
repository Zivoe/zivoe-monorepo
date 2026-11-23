import { z } from 'zod';

import { amountOfInterestOptionValues, referralSourceValues } from '@zivoe/database/onboarding';

import { isSupportedCountryCode } from '@/types/countries';

import { isOneLine, readsAsLink } from './reads-as-link';

// ISO 3166-1 alpha-2 code, restricted to the supported (non-sanctioned) list.
// Validated server-side too, since the server actions re-parse with these schemas.
const countryCodeSchema = z
  .string({ required_error: 'Please select a country' })
  .min(1, 'Please select a country')
  .refine(isSupportedCountryCode, 'Please select a valid country');

/** Persona prefills the inquiry from these and invitation emails print them, so a name is trimmed, bounded and no link. */
const MAX_NAME_LENGTH = 100;
const boundedName = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(MAX_NAME_LENGTH, `${label} is too long`)
    .refine(isOneLine, `${label} can't contain line breaks`)
    .refine((name) => !readsAsLink(name), `${label} can't look like a web address`);

/**
 * The Account details step of `/verification`: the person's answers, confirmed
 * or corrected before the Persona flow. The email is not here on purpose: it is
 * the sign-in identity and stays locked.
 */
export const investorProfileSchema = z.object({
  firstName: boundedName('First name'),
  lastName: boundedName('Last name'),
  // Persona prefills the inquiry's address country from this code.
  countryOfResidence: countryCodeSchema
});
export type InvestorProfileFormData = z.infer<typeof investorProfileSchema>;

/** Onboarding's first step: everyone is a person first. A company follows when they invest through one. */
export const onboardingSchema = investorProfileSchema.extend({
  amountOfInterest: z.enum(amountOfInterestOptionValues, { required_error: 'Please select an amount of interest' }),
  referralSource: z.enum(referralSourceValues, { required_error: 'Please select how you found Zivoe' })
});
export type OnboardingFormData = z.infer<typeof onboardingSchema>;
