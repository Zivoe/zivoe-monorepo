import { z } from 'zod';

import { isoDate } from './persona-inquiry';

// ---------------------------------------------------------------------------
// The JSON:API case resource as Persona returns it (kebab-case keys), in API
// responses and inside case webhook payloads alike. Only what the module
// reads is modelled: the template-defined status string, the template, and
// the ids of the inquiries attached. `fields`, `tags`, `resolved-at` and
// comments are never parsed: the decision is the status string, and the
// business's data stays in Persona.
// ---------------------------------------------------------------------------

export const personaCaseResourceSchema = z.object({
  id: z.string().min(1),
  attributes: z.object({
    status: z.string(),
    'created-at': isoDate,
    'updated-at': isoDate.nullish()
  }),
  relationships: z
    .object({
      'case-template': z.object({ data: z.object({ id: z.string() }).nullable() }).optional(),
      inquiries: z.object({ data: z.array(z.object({ id: z.string() })) }).optional()
    })
    .optional()
});

export type PersonaCaseResource = z.infer<typeof personaCaseResourceSchema>;

/** The slice of a Persona case the module reads. Never its contents. */
export type PersonaCase = {
  id: string;
  /** Persona's raw status string, as the case template defines it ("Waiting on UBOs", "Approved", …). */
  status: string;
  caseTemplateId: string | null;
  /** Every inquiry attached: the business inquiry and its owners' child inquiries, in no particular order. */
  inquiryIds: Array<string>;
  createdAt: Date;
  updatedAt: Date;
};

export function toPersonaCase(resource: PersonaCaseResource): PersonaCase {
  return {
    id: resource.id,
    status: resource.attributes.status,
    caseTemplateId: resource.relationships?.['case-template']?.data?.id ?? null,
    inquiryIds: resource.relationships?.inquiries?.data.map((inquiry) => inquiry.id) ?? [],
    createdAt: resource.attributes['created-at'],
    updatedAt: resource.attributes['updated-at'] ?? resource.attributes['created-at']
  };
}
