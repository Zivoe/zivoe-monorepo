'use client';

import { useEffect, useRef, useState } from 'react';

import { type InvestorProfile } from '@/server/data/investor-profile';
import { type KycStatusView, isYesDecision } from '@/server/kyc/kyc-status';

import { InvestorProfileStep } from './investor-profile-step';
import KycFlow from './kyc-flow';
import VerificationShell from './verification-shell';
import { type VerificationStepId, VerificationSteps } from './verification-steps';
import { WalletLinkStep } from './wallet-link-step';

/**
 * The `/verification` flow inside `VerificationShell`: the step rail and the
 * three steps it moves between — the Investor Profile (the onboarding answers,
 * confirmed and saved), the Persona flow (`KycFlow`), and Wallets
 * (`WalletLinkStep`). A layout of its own, deliberately without the
 * dashboard's navigation: the ways out are Exit and finishing.
 *
 * Which step shows is the record's call. The profile step exists for one
 * moment: before any inquiry, since what is saved there prefills the inquiry
 * created next and a resume carries no prefill at all. So it is offered only
 * while the investor can still start; from the first inquiry on — in
 * progress, expired, submitted or decided — the page holds the identity
 * step, with the profile step marked done, whatever a stale render may have
 * shown a moment earlier. A yes Decision ends the identity step for good:
 * the page opens on Wallets with both earlier steps done, and that step is
 * the completed state. An organization's details are the team's, so it
 * opens on a locked profile step that says so. The one way back to the
 * profile step is Back on the identity step, and `KycFlow` withholds it
 * while a start is in flight or a Persona frame is up: no shell-level
 * control can unmount a live inquiry.
 */
export default function VerificationFlow({
  view,
  profile,
  userId
}: {
  view: KycStatusView;
  profile: InvestorProfile;
  /** Whose Linked addresses the Wallets step reads from the cache the page seeded. */
  userId: string;
}) {
  const canEditProfile = view.path === 'individual' && view.canStart;
  const isVerified = isYesDecision(view);

  // `count` is bumped on every move: the step subtree's key, so Back lands on
  // a form rebuilt from the saved values, and the trigger that moves focus to
  // the new step's content.
  const [nav, setNav] = useState<{ step: VerificationStepId; count: number }>({ step: 'profile', count: 0 });
  const go = (step: VerificationStepId) => setNav((current) => ({ step, count: current.count + 1 }));
  // The record outranks the navigation: once an inquiry exists the profile step is over, and once it is decided yes so is the identity step.
  const step: VerificationStepId = isVerified
    ? 'wallets'
    : view.path === 'organization' || canEditProfile
      ? nav.step
      : 'identity';

  // The values the server last accepted, so Back shows what is saved, not what the page first loaded.
  const [savedProfile, setSavedProfile] = useState(profile);

  // A move unmounts the control that had focus; the new step's content takes it, where the flow continues.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (nav.count > 0) contentRef.current?.focus();
  }, [nav]);

  // An organization never takes the identity step: its Decision shows on the profile step instead.
  const done: Array<VerificationStepId> = [];
  if (step !== 'profile') done.push('profile');
  if (step === 'wallets') done.push('identity');

  return (
    <VerificationShell
      rail={
        <nav>
          <VerificationSteps current={step} done={done} orientation="vertical" />
        </nav>
      }
      mobileRail={
        <nav>
          <VerificationSteps current={step} done={done} orientation="horizontal" />
        </nav>
      }
    >
      <div
        key={nav.count}
        ref={contentRef}
        tabIndex={-1}
        className="flex w-full max-w-2xl flex-1 flex-col outline-none"
      >
        {/* Spacers, as in the auth container: centred in a tall viewport, scrolling in a short one. */}
        <div className="min-h-11 flex-1" />

        <div className="flex w-full animate-in flex-col gap-11 duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
          {step === 'profile' ? (
            <InvestorProfileStep
              profile={savedProfile}
              view={view}
              onSaved={(saved) => {
                setSavedProfile(saved);
                go('identity');
              }}
            />
          ) : step === 'identity' ? (
            <KycFlow view={view} onBack={canEditProfile ? () => go('profile') : undefined} />
          ) : (
            <WalletLinkStep userId={userId} />
          )}
        </div>

        <div className="min-h-6 flex-1" />
      </div>
    </VerificationShell>
  );
}
