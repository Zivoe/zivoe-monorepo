/**
 * KYC operator actions — publishes one job through QStash to the deployed
 * app's `/api/kyc/operator`, where the KYC Verification module runs it. The
 * outcome is posted to the Persona Telegram channel; QStash carries no
 * response back. See docs/runbooks/persona-kyc-launch.md §7.
 *
 *   pnpm kyc:operator revoke <user-id>    set the Human-owned `revoked`
 *   pnpm kyc:operator approve <user-id>   set the Human-owned `manually_approved`
 *   pnpm kyc:operator resync <user-id>    re-read the user from Persona; lifts either
 */
import { Client } from '@upstash/qstash';

import { QSTASH_JOB_LABELS, getQstashFailureCallback } from '../src/lib/qstash';

const [action, userId] = process.argv.slice(2);
const token = process.env.QSTASH_TOKEN;
const baseUrl = process.env.APP_URL?.replace(/\/+$/, '');

if (!action || !['revoke', 'approve', 'resync'].includes(action) || !userId || !token || !baseUrl) {
  console.error(`
Usage:
  pnpm kyc:operator revoke <user-id>
  pnpm kyc:operator approve <user-id>
  pnpm kyc:operator resync <user-id>

Environment variables:
  QSTASH_TOKEN   Required
  APP_URL        Required — the deployment that runs the action (e.g., https://app.zivoe.com)
`);
  process.exit(1);
}

new Client({ token })
  .publishJSON({
    url: `${baseUrl}/api/kyc/operator`,
    body: { action, userId },
    retries: 1,
    failureCallback: getQstashFailureCallback(baseUrl),
    label: QSTASH_JOB_LABELS.kycOperator
  })
  .then(({ messageId }) => {
    console.log(`Published ${action} for ${userId} to ${baseUrl} (QStash message ${messageId}).`);
    console.log('The outcome arrives in the Persona Telegram channel.');
  })
  .catch((err: Error) => {
    console.error('Publish failed:', err.message);
    process.exit(1);
  });
