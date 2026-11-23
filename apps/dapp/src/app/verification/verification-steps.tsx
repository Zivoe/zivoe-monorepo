import { NextLink } from '@zivoe/ui/core/link';
import { BankIcon, CameraIcon, CheckIcon, DocumentIcon, UserIcon, WalletIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { type InvestorPath } from '@/server/verification/verification-status';

export type VerificationStepId = 'profile' | 'agreements' | 'identity' | 'wallets';

/** The third step is the Persona flow: a person's identity, or a business. */
const IDENTITY_STEP: Record<InvestorPath, { label: string; Icon: typeof UserIcon }> = {
  individual: { label: 'Identity verification', Icon: CameraIcon },
  organization: { label: 'Business verification', Icon: BankIcon }
};

/** In order: a step is done once the flow has moved past it. */
export const VERIFICATION_STEPS = [
  { id: 'profile', label: 'Account details', Icon: UserIcon },
  { id: 'agreements', label: 'Agreements', Icon: DocumentIcon },
  { id: 'identity', ...IDENTITY_STEP.individual },
  { id: 'wallets', label: 'Wallets', Icon: WalletIcon }
] as const satisfies ReadonlyArray<{ id: VerificationStepId; label: string; Icon: typeof UserIcon }>;

/** "Step 2 of 4", for a step's header. */
export const stepCountOf = (id: VerificationStepId) =>
  `Step ${VERIFICATION_STEPS.findIndex((step) => step.id === id) + 1} of ${VERIFICATION_STEPS.length}`;

/** The steps before `current`: the flow is linear, so those are the done ones. */
export const stepsBefore = (current: VerificationStepId): Array<VerificationStepId> =>
  VERIFICATION_STEPS.slice(
    0,
    VERIFICATION_STEPS.findIndex((step) => step.id === current)
  ).map((step) => step.id);

/**
 * The step `/verification` shows, from what the URL asks for (`?step=`) and what the record allows. A subject
 * whose verification can still start opens on its details, and stays there while it lacks a real country (its
 * first inquiry, and the checklist before it, turn on the country). Agreements come before the Persona flow,
 * and before Wallets for a subject that never accepted them; a yes Decision ends on Wallets.
 */
export function currentStepFor({
  requested,
  canStart,
  hasCountry,
  hasAccepted,
  isYesDecision
}: {
  requested: string | undefined;
  canStart: boolean;
  hasCountry: boolean;
  hasAccepted: boolean;
  isYesDecision: boolean;
}): VerificationStepId {
  if (requested === 'details' || (canStart && !hasCountry)) return 'profile';
  if (canStart && requested !== 'agreements' && requested !== 'identity') return 'profile';
  if (requested === 'agreements' || !hasAccepted) return 'agreements';
  return isYesDecision ? 'wallets' : 'identity';
}

type StepState = 'done' | 'current' | 'upcoming';

const BADGE_STYLES: Record<StepState, string> = {
  done: 'rounded-full bg-element-primary text-base',
  current: 'rounded-md bg-surface-base text-brand shadow-[0_0_0_1px] shadow-default',
  upcoming: 'rounded-md border border-neutral-400 text-icon-default'
};

const ROW_GAP = 'items-center gap-1.5 min-[375px]:gap-3';

const LABEL_STYLES: Record<StepState, string> = {
  done: 'text-primary',
  current: 'font-medium text-primary',
  upcoming: 'text-secondary'
};

/**
 * The step rail: a vertical list in the desktop sidebar, a compact row above
 * the content below `lg`. Presentational — the flow decides which step is
 * current and which are done; `aria-current="step"` says the same to a
 * screen reader.
 */
export function VerificationSteps({
  current,
  done,
  orientation,
  path,
  hrefs
}: {
  current: VerificationStepId;
  done: ReadonlyArray<VerificationStepId>;
  orientation: 'vertical' | 'horizontal';
  path: InvestorPath;
  /** Where a done step links back to (Account details, Agreements); withheld while a start is in flight. */
  hrefs?: Partial<Record<VerificationStepId, string>>;
}) {
  const vertical = orientation === 'vertical';
  const presentationOf = (step: (typeof VERIFICATION_STEPS)[number]) =>
    step.id === 'identity' ? IDENTITY_STEP[path] : step;

  return (
    // Four steps fit a 320 px phone only with the row's spacing tightened below 375 px.
    <ol aria-label="Verification steps" className={cn('flex', vertical ? 'flex-col' : ROW_GAP)}>
      {VERIFICATION_STEPS.map((step, index) => {
        const state: StepState = done.includes(step.id) ? 'done' : step.id === current ? 'current' : 'upcoming';
        const { label, Icon: StepIcon } = presentationOf(step);
        const Icon = state === 'done' ? CheckIcon : StepIcon;
        const href = state === 'done' ? hrefs?.[step.id] : undefined;
        // The last step is the completed state, so one step is always current.
        const isLabelShown = state === 'current';

        return (
          <li
            key={step.id}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn('flex', vertical ? 'flex-col' : ROW_GAP)}
          >
            <div className={cn('flex items-center', vertical ? 'gap-3' : ROW_GAP)}>
              <span
                className={cn(
                  'flex shrink-0 items-center justify-center [&_svg]:size-4',
                  vertical ? 'size-8' : 'size-7',
                  BADGE_STYLES[state]
                )}
              >
                <Icon aria-hidden="true" />
              </span>

              {/* Below `sm` the row has room for one step's name only; the others stay readable to assistive tech. */}
              <span
                className={cn(
                  vertical ? 'text-regular' : 'text-small',
                  LABEL_STYLES[state],
                  !vertical && !isLabelShown && 'sr-only sm:not-sr-only'
                )}
              >
                {/* The way back to an earlier step, which shows read-only once verification has started. */}
                {href ? (
                  <NextLink href={href} className="underline-offset-4 hover:underline">
                    {label}
                  </NextLink>
                ) : (
                  label
                )}
              </span>
              {state === 'done' ? <span className="sr-only">, completed</span> : null}
            </div>

            {index < VERIFICATION_STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn('bg-tertiary-600', vertical ? 'my-1.5 ml-4 h-6 w-px' : 'h-px w-3 min-[375px]:w-4')}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
