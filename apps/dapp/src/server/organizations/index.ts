import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { Client } from '@upstash/qstash';

import { getCountryLabel } from '@/types/countries';

import { db } from '@/server/clients/db';
import { BASE_URL } from '@/server/utils/base-url';
import { organizationLabel } from '@/server/utils/operator-labels';
import { sendOrganizationInvitationEmail, sendOrganizationMemberRemovedEmail } from '@/server/utils/send-email';
import { sendTelegramMessage } from '@/server/utils/send-telegram';

import {
  QSTASH_JOB_LABELS,
  WALLET_LINK_RECONCILE_PATH,
  WALLET_LINK_RECONCILE_TRIGGER_PARAM,
  getQstashFailureCallback
} from '@/lib/qstash';
import { escapeHtml } from '@/lib/utils';

import { env } from '@/env';

import { createQstashOrganizationOutbox } from './organization-outbox';
import { createOrganizations } from './organizations';

// The wiring, and only the wiring.

/** Same one-quick-retry client as the other outboxes: a server action should not hang on a queue outage. */
const outboxQstash = new Client({ token: env.QSTASH_TOKEN, retry: { retries: 1, backoff: () => 200 } });

export const organizations = createOrganizations({
  db,
  outbox: createQstashOrganizationOutbox({ qstash: outboxQstash, baseUrl: BASE_URL }),
  walletLinkSweep: {
    async notify({ subjectId }) {
      try {
        await outboxQstash.publishJSON({
          url: `${BASE_URL}${WALLET_LINK_RECONCILE_PATH}?${WALLET_LINK_RECONCILE_TRIGGER_PARAM}=organization-deleted`,
          body: { subjectId },
          retries: 3,
          failureCallback: getQstashFailureCallback(BASE_URL),
          label: QSTASH_JOB_LABELS.walletLinkReconcile
        });
      } catch (error) {
        Sentry.captureException(error, { tags: { source: 'API', flow: 'wallet-link-trigger' }, extra: { subjectId } });
      }
    }
  },
  emails: {
    async sendInvitation(input) {
      await sendOrganizationInvitationEmail(input);
    },
    async sendMemberRemoved(input) {
      await sendOrganizationMemberRemovedEmail(input);
    }
  },
  // The onboarding channel, beside "New User Onboarded": a company arriving is a lead, whether it is
  // created during onboarding or later.
  operatorMessages: {
    async sendOrganizationCreated({ organizationId, name, countryOfIncorporation, createdBy }) {
      await sendTelegramMessage({
        chatId: env.TELEGRAM_ONBOARDING_CHAT_ID,
        text: [
          '<b>Organization created</b>',
          '',
          `<b>Organization:</b> ${organizationLabel({ name, id: organizationId })}`,
          `<b>Country:</b> ${countryOfIncorporation ? escapeHtml(getCountryLabel(countryOfIncorporation)) : 'unknown'}`,
          `<b>Created by:</b> ${createdBy ? `${escapeHtml(createdBy.name)} (${escapeHtml(createdBy.email)})` : 'unknown'}`,
          `<b>Job title:</b> ${createdBy?.title ? escapeHtml(createdBy.title) : 'unknown'}`
        ].join('\n')
      });
    }
  },
  reportDroppedJob({ job, error }) {
    Sentry.captureException(error, { tags: { source: 'API', flow: 'organization-outbox' }, extra: { job } });
  },
  clock: { now: () => new Date() }
});
