import { Badge } from '@zivoe/ui/core/badge';
import { Link } from '@zivoe/ui/core/link';
import { CheckCircleIcon, ClockIcon, LockIcon, WarningIcon } from '@zivoe/ui/icons';
import { tv } from '@zivoe/ui/lib/tw-utils';

import { type KycStatusView as KycStatusViewModel } from '@/server/kyc/kyc-status';

import { type KycStatusPresentation, presentKycStatus } from './kyc-status-copy';

// Pure renderer of a status view — exactly one state at a time, and nothing
// from `@/server`, so the `/verification` page renders it from a client component.

const cardStyles = tv({
  base: 'flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between',
  variants: {
    tone: {
      neutral: 'border-default bg-surface-base',
      progress: 'border-default bg-surface-elevated',
      success: 'border-default bg-surface-base',
      warning: 'border-default bg-element-warning-light',
      alert: 'border-default bg-element-alert-light'
    }
  }
});

const TONE_ICONS = {
  neutral: LockIcon,
  progress: ClockIcon,
  success: CheckCircleIcon,
  warning: WarningIcon,
  alert: WarningIcon
} satisfies Record<KycStatusPresentation['tone'], typeof LockIcon>;

/**
 * The status card on `/verification`, for the states with nothing to do: a
 * state whose only way forward is the team carries its support link. Start
 * and Continue never reach it — `KycFlow` renders its own action card for
 * them.
 */
export function KycStatusView({ view }: { view: KycStatusViewModel }) {
  const presentation = presentKycStatus(view);
  const Icon = TONE_ICONS[presentation.tone];
  const { action } = presentation;

  // `role="status"`: the card is what changes when a flow completes or a
  // start is refused, and the change must reach a screen reader as well.
  // Verified is the steady state for most investors: keep it compact.
  if (presentation.tone === 'success') {
    return (
      <div role="status" className={cardStyles({ tone: 'success', className: 'py-3' })}>
        <div className="flex items-center gap-3">
          <Badge variant="primary">
            <CheckCircleIcon aria-hidden="true" />
            Verified
          </Badge>
          <h2 className="font-paragraph! text-regular text-primary">{presentation.body}</h2>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className={cardStyles({ tone: presentation.tone })}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-icon-default" />
        <div className="flex flex-col gap-1">
          <h2 className="font-paragraph! text-leading font-medium text-primary">{presentation.title}</h2>
          <p className="text-small text-secondary">{presentation.body}</p>
        </div>
      </div>

      {action.kind === 'support' ? (
        <Link variant="border-light" href={action.href} className="shrink-0">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
