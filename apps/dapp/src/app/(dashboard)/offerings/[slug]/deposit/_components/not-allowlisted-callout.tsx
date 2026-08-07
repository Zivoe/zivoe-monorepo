import { Callout } from '@zivoe/ui/core/callout';

/**
 * Why a flow's action is disabled when the vault's allow list does not admit
 * the wallet. Shared by both flows so the one route out — asking to be added —
 * cannot drift between them.
 */
export function NotAllowlistedCallout() {
  return (
    <Callout variant="warning">
      You must be whitelisted to interact with this offer. Contact us at inquire@zivoe.com to request access.
    </Callout>
  );
}
