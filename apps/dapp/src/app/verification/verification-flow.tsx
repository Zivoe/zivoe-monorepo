'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { type InvestorProfile } from '@/server/data/investor-profile';

import { AccountDetailsStep } from './account-details-step';
import { AccountSwitcher, type SubjectOption } from './account-switcher';
import { AgreementsStep } from './agreements-step';
import PersonaFlow from './persona-flow';
import { organizationIdOf, verificationHref } from './verification-href';
import VerificationShell from './verification-shell';
import { type VerificationStepId, VerificationSteps, stepsBefore } from './verification-steps';
import { WalletLinkStep } from './wallet-link-step';

/**
 * The `/verification` flow inside `VerificationShell`: the account switcher
 * and step rail, and the four steps they move between. Step one confirms the
 * selected account's details (`AccountDetailsStep`), step two is the Persona
 * flow (a person's identity or an organization's business), step three
 * accepts the agreements (`AgreementsStep`), step four Wallets.
 * A layout of its own, deliberately without the dashboard's navigation: the
 * ways out are Exit and finishing.
 *
 * Who is being verified is the switcher's call, at the top of the rail on every
 * step; which step shows is the URL's and the record's, read by the page. A yes
 * Decision ends the first two steps for good: the page opens on the Agreements
 * step until the viewer accepts the version in force, then on Wallets, which is
 * the completed state, and nothing links back. Before one, the switcher and the
 * link back to Account details are disabled only while a start is in flight;
 * leaving an open Persona form is like a refresh: Persona keeps the progress.
 */
export default function VerificationFlow({
  subjects,
  activeId,
  step,
  profile
}: {
  subjects: Array<SubjectOption>;
  activeId: string;
  step: VerificationStepId;
  profile: InvestorProfile;
}) {
  const router = useRouter();
  const active = subjects.find((subject) => subject.id === activeId) ?? subjects[0];
  const [isStarting, setIsStarting] = useState(false);

  // The steps are one page with different URLs: a move unmounts the control
  // that had focus, and the new step's content takes it.
  const moveKey = `${activeId}:${step}`;
  const contentRef = useRef<HTMLDivElement>(null);
  const firstKey = useRef(moveKey);
  useEffect(() => {
    if (firstKey.current !== moveKey) contentRef.current?.focus();
    firstKey.current = moveKey;
  }, [moveKey]);

  if (!active) return null;

  const done = stepsBefore(step);
  const organizationId = organizationIdOf(active);
  // Back to the details before a yes Decision only: after one, nothing earlier opens again.
  const hrefs =
    isStarting || step === 'agreements' || step === 'wallets'
      ? undefined
      : { profile: verificationHref({ organizationId, step: 'details' }) };
  // The checklist before the Persona flow turns on this: the country of residence, or of incorporation.
  const countryCode = active.organization ? active.organization.countryOfIncorporation : profile.countryOfResidence;
  const switcher = <AccountSwitcher subjects={subjects} activeId={active.id} isDisabled={isStarting} />;

  return (
    <VerificationShell
      rail={
        <nav className="flex flex-col gap-6">
          {switcher}
          <VerificationSteps current={step} done={done} orientation="vertical" path={active.view.path} hrefs={hrefs} />
        </nav>
      }
      mobileRail={
        <nav className="flex flex-col gap-3">
          {switcher}
          <VerificationSteps
            current={step}
            done={done}
            orientation="horizontal"
            path={active.view.path}
            hrefs={hrefs}
          />
        </nav>
      }
    >
      <div key={moveKey} ref={contentRef} tabIndex={-1} className="flex w-full max-w-2xl flex-1 flex-col outline-none">
        {/* Spacers, as in the auth container: centred in a tall viewport, scrolling in a short one. */}
        <div className="min-h-11 flex-1" />

        <div className="flex w-full animate-in flex-col gap-11 break-words duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
          {step === 'profile' ? (
            <AccountDetailsStep key={active.id} subject={active} profile={profile} />
          ) : step === 'agreements' ? (
            <AgreementsStep />
          ) : step === 'identity' ? (
            <PersonaFlow
              subjectId={active.id}
              view={active.view}
              countryCode={countryCode}
              onBack={
                active.view.canStart
                  ? () => router.push(verificationHref({ organizationId, step: 'details' }))
                  : undefined
              }
              onStartingChange={setIsStarting}
            />
          ) : (
            <WalletLinkStep subjectId={active.id} organizationName={active.organization?.name} />
          )}
        </div>

        <div className="min-h-6 flex-1" />
      </div>
    </VerificationShell>
  );
}
