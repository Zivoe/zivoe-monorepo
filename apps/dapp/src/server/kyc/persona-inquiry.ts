import { z } from 'zod';

import { isPersonaInquiryStatus } from './kyc-status';
import { type ParsedPersonaInquiry } from './kyc-verification';

// ---------------------------------------------------------------------------
// The JSON:API inquiry resource as Persona returns it (kebab-case keys), in
// API responses and inside webhook payloads alike. Only the handful of fields
// the module reads are modelled; the rest (names, documents) is never parsed.
// ---------------------------------------------------------------------------

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'expected an ISO 8601 timestamp')
  .transform((value) => new Date(value));

export const personaInquiryResourceSchema = z.object({
  id: z.string().min(1),
  attributes: z.object({
    status: z.string(),
    'reference-id': z.string().nullish(),
    'created-at': isoDate,
    'updated-at': isoDate.nullish(),
    'redacted-at': isoDate.nullish()
  }),
  relationships: z
    .object({
      account: z.object({ data: z.object({ id: z.string() }).nullable() }).optional(),
      'inquiry-template': z.object({ data: z.object({ id: z.string() }).nullable() }).optional(),
      'inquiry-template-version': z.object({ data: z.object({ id: z.string() }).nullable() }).optional()
    })
    .optional()
});

export type PersonaInquiryResource = z.infer<typeof personaInquiryResourceSchema>;

/** The module's view of the resource; `status` is null for a status we do not model (lenient by design). */
export function toPersonaInquiry(resource: PersonaInquiryResource): ParsedPersonaInquiry {
  const status = resource.attributes.status;

  return {
    id: resource.id,
    status: isPersonaInquiryStatus(status) ? status : null,
    referenceId: resource.attributes['reference-id'] ?? null,
    accountId: resource.relationships?.account?.data?.id ?? null,
    templateId: resource.relationships?.['inquiry-template']?.data?.id ?? null,
    templateVersionId: resource.relationships?.['inquiry-template-version']?.data?.id ?? null,
    redacted: !!resource.attributes['redacted-at'],
    createdAt: resource.attributes['created-at'],
    updatedAt: resource.attributes['updated-at'] ?? resource.attributes['created-at']
  };
}
