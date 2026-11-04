import { describe, expect, it } from 'vitest';

import { personaCaseResourceSchema, toPersonaCase } from './persona-case';
import { parsePersonaWebhookEvent } from './persona-webhook';

// A case as Persona delivers it: the template-defined status and the ids on
// it, among attributes the module never reads.
const CASE = {
  type: 'case',
  id: 'case_1',
  attributes: {
    status: 'Waiting on UBOs',
    name: 'KYB-2',
    resolution: null,
    'resolved-at': null,
    'created-at': '2026-10-13T01:10:50.629Z',
    'updated-at': '2026-10-13T01:10:50.911Z',
    tags: ['BRV FAILED'],
    fields: { business_name: { type: 'string', value: 'never read' } }
  },
  relationships: {
    'case-template': { data: { type: 'case-template', id: 'ctmpl_kyb' } },
    inquiries: {
      data: [
        { type: 'inquiry', id: 'inq_business' },
        { type: 'inquiry', id: 'inq_owner' }
      ]
    },
    accounts: {
      data: [
        { type: 'account', id: 'act_business' },
        { type: 'account', id: 'act_owner' }
      ]
    },
    reports: { data: [{ type: 'report/business-watchlist', id: 'rep_1' }] }
  }
};

const event = ({ name, payload }: { name: string; payload: unknown }) =>
  JSON.stringify({
    data: {
      type: 'event',
      id: 'evt_1',
      attributes: { name, 'created-at': '2026-10-13T01:10:50.676Z', payload: { data: payload } }
    }
  });

describe('the Persona case resource', () => {
  it('reads the status, the template and the attached inquiries, and nothing of the business', () => {
    const parsed = toPersonaCase(personaCaseResourceSchema.parse(CASE));

    expect(parsed).toEqual({
      id: 'case_1',
      status: 'Waiting on UBOs',
      caseTemplateId: 'ctmpl_kyb',
      inquiryIds: ['inq_business', 'inq_owner'],
      createdAt: new Date('2026-10-13T01:10:50.629Z'),
      updatedAt: new Date('2026-10-13T01:10:50.911Z')
    });
    expect(JSON.stringify(parsed)).not.toContain('never read');
  });

  it('tolerates withheld relationships and a missing updated-at', () => {
    const parsed = toPersonaCase(
      personaCaseResourceSchema.parse({
        id: 'case_2',
        attributes: { status: 'Approved', 'created-at': CASE.attributes['created-at'] }
      })
    );

    expect(parsed).toMatchObject({ status: 'Approved', caseTemplateId: null, inquiryIds: [] });
    expect(parsed.updatedAt).toEqual(parsed.createdAt);
  });
});

describe('parsePersonaWebhookEvent tells a case from an inquiry by the event name', () => {
  it('carries a case for a case.* event and no inquiry, although the payload would pass for one', () => {
    const parsed = parsePersonaWebhookEvent(event({ name: 'case.status-updated', payload: CASE }));

    expect(parsed?.case).toMatchObject({ id: 'case_1', status: 'Waiting on UBOs' });
    expect(parsed?.inquiry).toBeNull();
    expect(parsed?.resourceId).toBe('case_1');
  });

  it('carries an inquiry for an inquiry.* event and no case', () => {
    const parsed = parsePersonaWebhookEvent(
      event({
        name: 'inquiry.completed',
        payload: {
          type: 'inquiry',
          id: 'inq_1',
          attributes: { status: 'completed', 'created-at': CASE.attributes['created-at'] }
        }
      })
    );

    expect(parsed?.inquiry).toMatchObject({ id: 'inq_1', status: 'completed' });
    expect(parsed?.case).toBeNull();
  });
});
