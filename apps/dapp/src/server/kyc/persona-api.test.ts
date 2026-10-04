import { describe, expect, it, vi } from 'vitest';

import { createPersonaApi } from './persona-api';

const INQUIRY_RESOURCE = {
  type: 'inquiry',
  id: 'inq_ABC123',
  attributes: {
    status: 'created',
    'reference-id': 'user-1',
    'created-at': '2026-08-22T10:00:00.000Z',
    'updated-at': '2026-08-22T10:00:00.000Z',
    'name-first': 'never read'
  },
  relationships: {
    account: { data: { type: 'account', id: 'act_XYZ' } },
    template: { data: null },
    'inquiry-template': { data: { type: 'inquiry-template', id: 'itmpl_1' } },
    'inquiry-template-version': { data: { type: 'inquiry-template-version', id: 'itmplv_1' } }
  }
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function api(fetchImpl: ReturnType<typeof vi.fn>) {
  return createPersonaApi({ apiKey: 'persona_sandbox_key', templateVersionId: 'itmplv_1', fetchImpl });
}

describe('createPersonaApi', () => {
  it('creates an inquiry with the documented body and reads the session token from the response meta', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: INQUIRY_RESOURCE, meta: { 'session-token': 'tok' } }, 201));

    const result = await api(fetchImpl).createInquiry({
      referenceId: 'user-1',
      prefill: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', countryCode: 'GB' },
      idempotencyKey: 'key-1'
    });

    expect(result).toEqual({
      ok: true,
      value: {
        inquiry: {
          id: 'inq_ABC123',
          status: 'created',
          referenceId: 'user-1',
          accountId: 'act_XYZ',
          templateId: 'itmpl_1',
          templateVersionId: 'itmplv_1',
          redacted: false,
          createdAt: new Date('2026-08-22T10:00:00.000Z'),
          updatedAt: new Date('2026-08-22T10:00:00.000Z')
        },
        sessionToken: 'tok'
      }
    });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.withpersona.com/api/v1/inquiries');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer persona_sandbox_key',
      'Persona-Version': '2025-12-08',
      'Key-Inflection': 'kebab',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'key-1'
    });
    expect(JSON.parse(init.body as string)).toEqual({
      data: {
        attributes: {
          'inquiry-template-version-id': 'itmplv_1',
          fields: {
            'name-first': 'Ada',
            'name-last': 'Lovelace',
            'email-address': 'ada@example.com',
            'address-country-code': 'GB'
          }
        }
      },
      meta: {
        'auto-create-account': true,
        'auto-create-account-reference-id': 'user-1',
        'auto-create-inquiry-session': true
      }
    });
  });

  it('retries a create once with the same idempotency key when the connection failed', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce(jsonResponse({ data: INQUIRY_RESOURCE, meta: { 'session-token': 'tok' } }, 201));

    const result = await api(fetchImpl).createInquiry({
      referenceId: 'user-1',
      prefill: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', countryCode: null },
      idempotencyKey: 'key-1'
    });

    expect(result).toMatchObject({ ok: true, value: { inquiry: { id: 'inq_ABC123' } } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.map((call) => (call[1] as RequestInit).headers)).toEqual([
      expect.objectContaining({ 'Idempotency-Key': 'key-1' }),
      expect.objectContaining({ 'Idempotency-Key': 'key-1' })
    ]);
  });

  it('resumes by inquiry id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: { ...INQUIRY_RESOURCE, attributes: { ...INQUIRY_RESOURCE.attributes, status: 'pending' } },
        meta: { 'session-token': 'tok2' }
      })
    );

    const result = await api(fetchImpl).resumeInquiry({ inquiryId: 'inq_ABC123' });

    expect(result).toMatchObject({ ok: true, value: { inquiry: { status: 'pending' }, sessionToken: 'tok2' } });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.withpersona.com/api/v1/inquiries/inq_ABC123/resume');
  });

  it('lists by reference id, newest first, keeping a status it does not model as null', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            ...INQUIRY_RESOURCE,
            id: 'inq_old',
            attributes: { ...INQUIRY_RESOURCE.attributes, 'created-at': '2026-08-01T00:00:00Z' }
          },
          {
            ...INQUIRY_RESOURCE,
            id: 'inq_new',
            attributes: { ...INQUIRY_RESOURCE.attributes, 'created-at': '2026-08-20T00:00:00Z' }
          },
          {
            ...INQUIRY_RESOURCE,
            id: 'inq_odd',
            attributes: {
              ...INQUIRY_RESOURCE.attributes,
              status: 'something_new',
              'created-at': '2026-08-10T00:00:00Z'
            }
          }
        ]
      })
    );

    const result = await api(fetchImpl).listInquiries({ referenceId: 'user-1' });

    expect(result.ok && result.value.map((inquiry) => [inquiry.id, inquiry.status])).toEqual([
      ['inq_new', 'created'],
      ['inq_odd', null],
      ['inq_old', 'created']
    ]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://api.withpersona.com/api/v1/inquiries?filter%5Breference-id%5D=user-1&page%5Bsize%5D=25'
    );
  });

  it('returns typed errors instead of throwing', async () => {
    const http = api(vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 })));
    const invalid = api(vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'inq_1' } })));
    const network = api(vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    await expect(http.listInquiries({ referenceId: 'u' })).resolves.toEqual({
      ok: false,
      error: {
        reason: 'http',
        message: 'Persona GET /inquiries?filter%5Breference-id%5D=u&page%5Bsize%5D=25 failed (429)',
        httpStatus: 429
      }
    });
    await expect(invalid.resumeInquiry({ inquiryId: 'inq_1' })).resolves.toMatchObject({
      ok: false,
      error: { reason: 'invalid_response' }
    });
    await expect(network.resumeInquiry({ inquiryId: 'inq_1' })).resolves.toEqual({
      ok: false,
      error: { reason: 'network', message: 'ECONNRESET' }
    });
  });

  it('waits out a 429 whose window resets within seconds, once, and reports the rate-limit headers', async () => {
    const onRateLimit = vi.fn();
    const limited = new Response('rate limited', {
      status: 429,
      headers: { 'RateLimit-Limit': '300', 'RateLimit-Remaining': '0', 'RateLimit-Reset': '0' }
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(limited)
      .mockResolvedValueOnce(jsonResponse({ data: [] }));
    const api = createPersonaApi({ apiKey: 'k', templateVersionId: 'itmplv_1', fetchImpl, onRateLimit });

    await expect(api.listInquiries({ referenceId: 'u' })).resolves.toEqual({ ok: true, value: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onRateLimit).toHaveBeenCalledWith({ limit: 300, remaining: 0, resetSeconds: 0 });
  });

  it('does not wait out a 429 whose window resets far away', async () => {
    const limited = new Response('rate limited', {
      status: 429,
      headers: { 'RateLimit-Limit': '300', 'RateLimit-Remaining': '0', 'RateLimit-Reset': '30' }
    });
    const fetchImpl = vi.fn().mockResolvedValue(limited);

    await expect(api(fetchImpl).listInquiries({ referenceId: 'u' })).resolves.toMatchObject({
      ok: false,
      error: { reason: 'http', httpStatus: 429 }
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reads the latest published version of an inquiry template', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          type: 'inquiry-template',
          id: 'itmpl_1',
          attributes: { name: 'Investor KYC', status: 'active' },
          relationships: { 'latest-published-version': { data: { type: 'inquiry-template-version', id: 'itmplv_9' } } }
        }
      })
    );

    const result = await api(fetchImpl).latestPublishedVersion({ templateId: 'itmpl_1' });

    expect(result).toEqual({ ok: true, value: 'itmplv_9' });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.withpersona.com/api/v1/inquiry-templates/itmpl_1');
  });

  it('lists the registered webhooks with the slice the drift check compares', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            type: 'webhook',
            id: 'wbh_1',
            attributes: {
              status: 'enabled',
              url: 'https://app.zivoe.com/api/webhooks/persona',
              'api-version': '2025-12-08',
              'enabled-events': ['inquiry.approved'],
              'api-key-inflection': 'kebab',
              'api-attributes-blocklist': ['/data/attributes/*'],
              'relationship-allowlist': 'include_all',
              'created-at': '2026-08-22T10:00:00.000Z'
            }
          },
          // A legacy webhook with no explicit events or version still parses.
          { type: 'webhook', id: 'wbh_2', attributes: { status: 'disabled', url: 'https://old.example.com' } },
          // The object shape Persona returns since 2026-10 collapses to what the drift check compares.
          {
            type: 'webhook',
            id: 'wbh_3',
            attributes: {
              status: 'enabled',
              url: 'https://all.example.com',
              'relationship-allowlist': { state: 'include_all' }
            }
          },
          {
            type: 'webhook',
            id: 'wbh_4',
            attributes: {
              status: 'enabled',
              url: 'https://some.example.com',
              'relationship-allowlist': { state: 'include_some', relationships: ['account'] }
            }
          },
          // A setting in a shape the adapter does not know costs that field, not the read.
          {
            type: 'webhook',
            id: 'wbh_5',
            attributes: { status: 'enabled', url: 'https://odd.example.com', 'enabled-events': { state: 'all' } }
          }
        ]
      })
    );

    const result = await api(fetchImpl).listWebhooks();

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: 'wbh_1',
          status: 'enabled',
          url: 'https://app.zivoe.com/api/webhooks/persona',
          apiVersion: '2025-12-08',
          enabledEvents: ['inquiry.approved'],
          keyInflection: 'kebab',
          attributeBlocklist: ['/data/attributes/*'],
          relationshipAllowlist: 'include_all',
          unreadable: []
        },
        {
          id: 'wbh_2',
          status: 'disabled',
          url: 'https://old.example.com',
          apiVersion: null,
          enabledEvents: [],
          keyInflection: null,
          attributeBlocklist: [],
          relationshipAllowlist: null,
          unreadable: []
        },
        expect.objectContaining({ id: 'wbh_3', relationshipAllowlist: 'include_all' }),
        expect.objectContaining({ id: 'wbh_4', relationshipAllowlist: ['account'] }),
        expect.objectContaining({ id: 'wbh_5', enabledEvents: [], unreadable: ['enabled-events'] })
      ]
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.withpersona.com/api/v1/webhooks');
  });
});
