import { Callout } from '@zivoe/ui/core/callout';

import { EMAILS } from '@/lib/utils';

/**
 * Why a flow's action is disabled when the vault's allow list does not admit
 * the wallet. Shared by both flows so the one route out — asking to be added —
 * cannot drift between them.
 */
export function NotAllowlistedCallout() {
  return (
    <Callout variant="warning">
      You must be whitelisted to interact with this offer. Contact us at{' '}
      <a href={`mailto:${EMAILS.INQUIRE}`} className="underline underline-offset-4 hover:no-underline">
        {EMAILS.INQUIRE}
      </a>{' '}
      to request access.
    </Callout>
  );
}
