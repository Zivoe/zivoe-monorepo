import { ContextualHelp, ContextualHelpDescription } from '@zivoe/ui/core/contextual-help';

/** The published Target APY is a target before fees — the number never appears without this. */
const TARGET_APY_DISCLOSURE =
  'Target APY is calculated before fees and expenses. It is a target, not a guaranteed return, and may change. For more information, please see offer terms.';

export default function TargetApyDisclosure({ triggerClassName }: { triggerClassName?: string }) {
  return (
    <ContextualHelp variant="info" aria-label="About Target APY" triggerClassName={triggerClassName}>
      <ContextualHelpDescription>{TARGET_APY_DISCLOSURE}</ContextualHelpDescription>
    </ContextualHelp>
  );
}
