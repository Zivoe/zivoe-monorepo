import { z } from 'zod';

import { isSupportedCountryCode } from '@/types/countries';

import { isOneLine, readsAsLink } from './reads-as-link';

const MAX_ORGANIZATION_NAME_LENGTH = 150;
const MAX_TITLE_LENGTH = 100;

/**
 * A legal name, as Persona verifies it and as emails and ops lines repeat it, so
 * it must not read as a link or an address: letters, digits and the punctuation
 * company names use, nothing that makes it a URL, a domain or an email.
 */
export const organizationNameSchema = z
  .string({ required_error: 'Legal name is required' })
  .trim()
  .min(1, 'Legal name is required')
  .min(2, 'Legal name is too short')
  .max(MAX_ORGANIZATION_NAME_LENGTH, 'Legal name is too long')
  .regex(/^[\p{L}\p{M}\p{N} &'’.,\-()/!+]+$/u, 'Use letters, digits and common punctuation only')
  .refine((name) => !readsAsLink(name), {
    message: "A legal name can't look like a web address. If yours does, email inquire@zivoe.com"
  });

const countryCodeSchema = z
  .string({ required_error: 'Please select a country' })
  .min(1, 'Please select a country')
  .refine(isSupportedCountryCode, 'Please select a valid country');

export const organizationDetailsSchema = z.object({
  name: organizationNameSchema,
  countryOfIncorporation: countryCodeSchema,
  title: z
    .string({ required_error: 'Job title is required' })
    .trim()
    .min(1, 'Job title is required')
    .max(MAX_TITLE_LENGTH, 'Job title is too long')
    .refine(isOneLine, "Job title can't contain line breaks")
});
export type OrganizationDetailsFormData = z.infer<typeof organizationDetailsSchema>;

/** ASCII only: a look-alike address must not pass for a colleague's. Lowercased, as invitations store it. */
export const invitationEmailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254, 'Enter a valid email address')
  // ASCII only: nothing outside it.
  .regex(/^[\x00-\x7F]+$/, 'Enter a valid email address');

/** How many addresses one invite may carry: the invite form's fields stop there too. */
export const MAX_INVITATIONS_AT_ONCE = 10;

/** What onboarding's invite step and the members page post: a few addresses at once. */
export const inviteMembersSchema = z.object({
  organizationId: z.string().uuid(),
  emails: z.array(invitationEmailSchema).min(1).max(MAX_INVITATIONS_AT_ONCE)
});
