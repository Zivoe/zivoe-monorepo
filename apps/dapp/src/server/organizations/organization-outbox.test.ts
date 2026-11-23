import { type Client } from '@upstash/qstash';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQstashOrganizationOutbox } from './organization-outbox';

vi.mock('server-only', () => ({}));

const job = { kind: 'organization_created_ops', organizationId: '9b1c2d3e-4f50-4a61-8b72-1c2d3e4f5061' } as const;
const outboxWith = (publishJSON: () => Promise<unknown>) =>
  createQstashOrganizationOutbox({ qstash: { publishJSON } as unknown as Client, baseUrl: 'https://app.example' });

afterEach(() => vi.useRealTimers());

describe('the organization outbox', () => {
  it('gives up on a publish that hangs, so the transaction around it does not hold its lock', async () => {
    vi.useFakeTimers();
    const queued = outboxWith(() => new Promise(() => undefined)).enqueue(job);
    const settled = expect(queued).rejects.toThrow('timed out');

    await vi.advanceTimersByTimeAsync(5_000);
    await settled;
  });

  it('queues the job when QStash answers', async () => {
    const publishJSON = vi.fn(async () => ({ messageId: 'msg_1' }));

    await outboxWith(publishJSON).enqueue(job);

    expect(publishJSON).toHaveBeenCalledWith(
      expect.objectContaining({ body: job, url: 'https://app.example/api/organizations/job' })
    );
  });
});
