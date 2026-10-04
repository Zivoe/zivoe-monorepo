import { CheckIcon, DocumentIcon, UserIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

export type VerificationStepId = 'profile' | 'identity';

export const VERIFICATION_STEPS = [
  { id: 'profile', label: 'Investor profile', Icon: UserIcon },
  { id: 'identity', label: 'Identity verification', Icon: DocumentIcon }
] as const satisfies ReadonlyArray<{ id: VerificationStepId; label: string; Icon: typeof UserIcon }>;

type StepState = 'done' | 'current' | 'upcoming';

const BADGE_STYLES: Record<StepState, string> = {
  done: 'rounded-full bg-element-primary text-base',
  current: 'rounded-md bg-surface-base text-brand shadow-[0_0_0_1px] shadow-default',
  upcoming: 'rounded-md border border-neutral-400 text-icon-default'
};

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
  orientation
}: {
  current: VerificationStepId;
  done: ReadonlyArray<VerificationStepId>;
  orientation: 'vertical' | 'horizontal';
}) {
  const vertical = orientation === 'vertical';
  // Once every step is done none is current; the row then keeps the last label, not just icons.
  const hasCurrent = VERIFICATION_STEPS.some((step) => step.id === current && !done.includes(step.id));

  return (
    <ol aria-label="Verification steps" className={cn('flex', vertical ? 'flex-col' : 'items-center gap-3')}>
      {VERIFICATION_STEPS.map((step, index) => {
        const state: StepState = done.includes(step.id) ? 'done' : step.id === current ? 'current' : 'upcoming';
        const Icon = state === 'done' ? CheckIcon : step.Icon;
        const isLabelShown = state === 'current' || (!hasCurrent && index === VERIFICATION_STEPS.length - 1);

        return (
          <li
            key={step.id}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn('flex', vertical ? 'flex-col' : 'items-center gap-3')}
          >
            <div className="flex items-center gap-3">
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
                {step.label}
              </span>
              {state === 'done' ? <span className="sr-only">, completed</span> : null}
            </div>

            {index < VERIFICATION_STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn('bg-tertiary-600', vertical ? 'my-1.5 ml-4 h-6 w-px' : 'h-px w-4')}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
