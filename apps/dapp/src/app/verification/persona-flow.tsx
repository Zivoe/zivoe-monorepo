'use client';

import { useEffect, useId, useRef, useState } from 'react';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import * as Sentry from '@sentry/nextjs';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Checkbox } from '@zivoe/ui/core/checkbox';
import { toast } from '@zivoe/ui/core/sonner';
import { Spinner } from '@zivoe/ui/icons';

import { type VerificationStatusView as VerificationStatusViewModel } from '@/server/verification/verification-status';

import { withNext } from '@/lib/lighthouse';
import { ORGANIZATION_ERROR_COPY } from '@/lib/organization-copy';
import { verificationReturnPath } from '@/lib/return-paths';
import { handlePromise } from '@/lib/utils';

import { Auth } from '@/app/(auth)/_components/common';
import { type StartVerificationErrorResponse, type StartVerificationResponse } from '@/app/api/kyc/start/route';

import { env } from '@/env';

import { verificationHref } from './verification-href';
import { type VerificationRequirement, verificationRequirements } from './verification-requirements';
import { START_REFUSAL_COPY, presentVerificationStatus } from './verification-status-copy';
import { VerificationStatusView } from './verification-status-view';
import { stepCountOf } from './verification-steps';

// Persona's SDK is only needed once a flow is mounted; keep it out of the
// page's initial bundle (and off the server, where it has no business).
const PersonaInquiry = dynamic(() => import('persona-react'), { ssr: false });

/** After completion, re-read the status this often, for this long, so an auto-decision appears without a reload. */
const REFRESH_INTERVAL_MS = 5_000;
const REFRESH_FOR_MS = 2 * 60_000;
/**
 * How long the Start button rests after an answer that another click cannot
 * change yet. The start lock (409): long enough for the request holding it to
 * finish, short enough that a stale key (a failed release, at most a minute or
 * so) is a few waits and not a dead end. Persona unavailable: the server has
 * already retried inside the request, so an immediate click would fail the same
 * way and spend a rate-limit token. Rate limited: the server's Retry-After,
 * with a minute when it sends none.
 */
const LOCK_COOLDOWN_MS = 5_000;
const PERSONA_UNAVAILABLE_COOLDOWN_MS = 30_000;
const RATE_LIMIT_FALLBACK_MS = 60_000;

/**
 * The session token Persona handed out for an inquiry, kept for this tab. A
 * Continue after "Finish later" (or a reload) mounts the flow with it instead
 * of asking the server to resume: Persona reuses only a session the flow has
 * not loaded yet, caps the sessions an inquiry may have, and advises against
 * a resume per page load. One tab, one session — a new tab or device resumes
 * once, which is how Persona models a session anyway. Where storage is
 * unavailable (private mode, a blocked site) every Continue resumes, as before.
 */
const sessionTokenKey = (inquiryId: string) => `persona-session:${inquiryId}`;
function storedSessionToken(inquiryId: string) {
  try {
    return window.sessionStorage.getItem(sessionTokenKey(inquiryId));
  } catch {
    return null;
  }
}
function rememberSessionToken({ inquiryId, sessionToken }: { inquiryId: string; sessionToken: string }) {
  try {
    window.sessionStorage.setItem(sessionTokenKey(inquiryId), sessionToken);
  } catch {
    // Nothing to keep it in; the next Continue resumes.
  }
}
function forgetSessionToken(inquiryId: string) {
  try {
    window.sessionStorage.removeItem(sessionTokenKey(inquiryId));
  } catch {
    // Nothing was kept.
  }
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  /** `reused`: the token came from this tab's storage, not from the server. */
  | { kind: 'inquiry'; inquiryId: string; sessionToken: string; reused: boolean }
  | { kind: 'submitted' }
  | { kind: 'refused'; code: StartVerificationErrorResponse['code'] }
  /** Another click cannot help yet: no Retry, the button rests, then the view is re-read. */
  | { kind: 'cooldown'; message: string; ms: number }
  | { kind: 'error'; message: string };

const isRefusal = (body: StartVerificationResponse): body is StartVerificationErrorResponse => 'code' in body;

/** The page owns the words: a server's error text (a handler's generic message, a 404) never reaches the investor. */
const START_FAILED_COPY = 'Could not start verification. Please try again.';
const START_IN_FLIGHT_COPY = 'A verification is already being started. Try again in a moment.';

export default function PersonaFlow({
  subjectId,
  view,
  countryCode,
  onBack,
  onStartingChange
}: {
  /** Who is being verified: the person's own id, or the organization's. */
  subjectId: string;
  view: VerificationStatusViewModel;
  /** The subject's country of residence or of incorporation: the checklist before Start turns on it. */
  countryCode: string | null;
  /** Back to the Agreements step; offered while nothing is in flight. */
  onBack?: () => void;
  /** Tells the shell a start is in flight, so nothing above navigates away before it lands. */
  onStartingChange?: (isStarting: boolean) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  // The checklist's ticks: kept for this visit only, so a Continue days later asks again.
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  // Persona's SDK chunk and then Persona's own first paint take a few seconds;
  // the frame is blank until `onReady`, so the page shows the wait itself.
  const [frameReady, setFrameReady] = useState(false);
  // Pressing Start unmounts the button, so focus would fall to the body; it
  // lands on the frame's container instead, where the flow is.
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase.kind === 'inquiry') frameRef.current?.focus();
  }, [phase.kind]);
  // Below `sm` the frame covers the page; the page behind must not scroll
  // under it (Persona's own modal locks the body the same way).
  useEffect(() => {
    if (phase.kind !== 'inquiry' || !window.matchMedia('(max-width: 639px)').matches) return;
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, [phase.kind]);

  const isStarting = phase.kind === 'starting';
  useEffect(() => {
    onStartingChange?.(isStarting);
    return () => onStartingChange?.(false);
  }, [isStarting, onStartingChange]);

  const presentation = presentVerificationStatus(view);
  // Start / Continue, when the view allows either; the copy module derives it from the same domain facts.
  const { action } = presentation;
  const beginAction = action.kind === 'start' || action.kind === 'resume' ? action : null;

  // The step's header, above every phase. Back is withheld while a start is in
  // flight, the frame is up, or a submission/refusal is being confirmed.
  const canLeaveStep =
    phase.kind !== 'starting' && phase.kind !== 'inquiry' && phase.kind !== 'submitted' && phase.kind !== 'refused';
  const organization = view.path === 'organization';
  const requirements = verificationRequirements({ path: view.path, countryCode });
  const isReady = requirements.every((requirement) => ticked.has(requirement.id));
  // Before Start or Continue, the step is the checklist; every other phase names the verification itself.
  const isPreparing = !!beginAction && (phase.kind === 'idle' || phase.kind === 'cooldown' || phase.kind === 'error');
  const header = (
    <Auth.Header
      title={isPreparing ? 'Prepare your documents' : organization ? 'Business verification' : 'Identity verification'}
      description={
        isPreparing
          ? organization
            ? "Confirm you have everything ready. Business verification with Persona takes about fifteen minutes; Zivoe keeps only your verification status, never your documents or your owners' details."
            : 'Confirm you have everything ready. Identity verification with Persona takes about five minutes; Zivoe keeps only your verification status, never your documents.'
          : organization
            ? "Vaults accept deposits from verified investors. Verification is handled securely by Persona; Zivoe keeps only your verification status, never your documents or your owners' details."
            : 'Vaults accept deposits from verified investors. Verification is handled securely by Persona; Zivoe keeps only your verification status, never your documents.'
      }
    >
      <Auth.StepIndicator onBack={onBack && canLeaveStep ? onBack : undefined}>
        {stepCountOf('identity')}
      </Auth.StepIndicator>
    </Auth.Header>
  );
  const frameTitle = organization ? 'Verify your organization' : 'Verify your identity';

  // Inquiries are created only on click, never on page load. A Continue on
  // an in-flight inquiry first tries the session this tab already holds;
  // `expired` always goes to the server, which moves the inquiry back to
  // pending on resume.
  const start = async () => {
    setFrameReady(false);

    const inquiryId = view.status === 'in_progress' ? view.inquiryId : null;
    const stored = inquiryId ? storedSessionToken(inquiryId) : null;
    if (inquiryId && stored) {
      setPhase({ kind: 'inquiry', inquiryId, sessionToken: stored, reused: true });
      return;
    }

    setPhase({ kind: 'starting' });
    const { res, err } = await handlePromise(
      fetch('/api/kyc/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId })
      })
    );
    const body = res ? ((await handlePromise(res.json())).res as StartVerificationResponse | undefined) : undefined;

    if (err || !body) {
      setPhase({ kind: 'error', message: START_FAILED_COPY });
    } else if ('code' in body && body.code === 'agreements_required') {
      // Not accepted for this subject (only a hand-edited URL or a stale tab gets here): the step before this one.
      setPhase({ kind: 'idle' });
      toast({ type: 'warning', title: 'Accept the agreements before verifying.' });
      router.push(verificationHref({ organizationId: organization ? subjectId : null, step: 'agreements' }));
    } else if ('code' in body && body.code === 'not_member') {
      // No longer a member (removed with the page open): the refresh takes them to their own page, the words with them.
      toast({ type: 'warning', title: ORGANIZATION_ERROR_COPY.not_member });
      router.refresh();
    } else if (isRefusal(body) && (body.code === 'persona_unavailable' || body.code === 'queue_unavailable')) {
      // Not a state change: the server is already capturing it, and the page rests before the next try.
      setPhase({
        kind: 'cooldown',
        message: START_REFUSAL_COPY.persona_unavailable,
        ms: PERSONA_UNAVAILABLE_COOLDOWN_MS
      });
    } else if (isRefusal(body)) {
      setPhase({ kind: 'refused', code: body.code });
      // The server has newer information: hide the obsolete action while the view refreshes.
      router.refresh();
    } else if ('success' in body) {
      rememberSessionToken(body.data);
      setPhase({ kind: 'inquiry', ...body.data, reused: false });
      // The record has an inquiry now: re-read it, so the rail marks the
      // profile step done and Back goes away (there is no profile left to
      // redo once Persona holds one). The frame stays mounted.
      router.refresh();
    } else if (res?.status === 401) {
      // Signed out mid-visit: the sign-in page is the answer, not a retry loop
      // — and it brings them back here, like the page's own redirect does.
      // The person's own page is plain `/verification`; an organization's names it.
      router.push(withNext('/sign-in', verificationReturnPath(organization ? subjectId : null)));
    } else if (res?.status === 403) {
      // Behind the terms (updated mid-visit): the page's own redirect sends them to accept, then back here.
      setPhase({ kind: 'error', message: START_FAILED_COPY });
      router.refresh();
    } else if (res?.status === 409) {
      // The start lock: a request from this user is still running (a double
      // click, a second tab) or a release failed and the key has yet to
      // expire. Nothing here can hurry either, and every click spends a
      // rate-limit token, so the page rests instead of offering a Retry.
      setPhase({ kind: 'cooldown', message: START_IN_FLIGHT_COPY, ms: LOCK_COOLDOWN_MS });
    } else if (res?.status === 429) {
      // A Retry now would be limited again; the button comes back when the window allows.
      const retryAfterSeconds = Number(res.headers.get('Retry-After'));
      setPhase({
        kind: 'cooldown',
        message: 'Too many attempts. Please try again in a few minutes.',
        ms: retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : RATE_LIMIT_FALLBACK_MS
      });
    } else {
      // A server fault, or a 404 when the `kyc` flag turned off mid-visit.
      setPhase({ kind: 'error', message: START_FAILED_COPY });
    }
  };

  // While the page waits on the record, the server's view is the truth and a
  // tab left open goes stale: re-read it whenever the tab comes back into
  // view. Idle, that keeps a Continue acting on the present — a decision may
  // have landed, or another device's Continue replaced the inquiry, and a
  // stored session must never mount for an inquiry the record no longer
  // points at.
  //
  // After a completion the page also polls, for a bounded time, so an
  // auto-decision appears without a reload, and stops once the record has
  // moved past "submitted" (a decision or a review). A failure is still
  // waiting on Persona — the Inquiry Failed Workflow decides it seconds
  // later — so the polling runs on through it.
  const serverStillPreSubmission =
    view.status === 'in_progress' || view.status === 'expired' || view.status === 'not_started';
  const serverAwaitingDecision = serverStillPreSubmission || view.status === 'submitted' || view.status === 'failed';
  const polling = phase.kind === 'submitted' && serverAwaitingDecision;
  const watching = phase.kind === 'idle' || polling;
  // Once the server has moved past the submission the optimistic phase has
  // nothing left to show, and the page is idle again: no ticks, but a tab
  // coming back into view re-reads — a review can change what it waits on
  // days later, and a decision may have landed.
  useEffect(() => {
    if (phase.kind === 'submitted' && !serverAwaitingDecision) setPhase({ kind: 'idle' });
  }, [phase.kind, serverAwaitingDecision]);
  useEffect(() => {
    if (!watching) return;

    // A hidden tab re-renders nothing anyone sees, so the ticks skip it; the
    // refresh on return is what shows a decision to someone who tabbed away.
    const until = polling ? Date.now() + REFRESH_FOR_MS : Infinity;
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() <= until) router.refresh();
    };
    const interval = polling
      ? setInterval(() => (Date.now() > until ? clearInterval(interval) : refreshIfVisible()), REFRESH_INTERVAL_MS)
      : undefined;
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [watching, polling, router]);

  // The rest ends with a re-read, not a retry: the request that held the lock
  // may have left a resumable inquiry behind, and the view should say Continue.
  const cooldownMs = phase.kind === 'cooldown' ? phase.ms : null;
  useEffect(() => {
    if (cooldownMs === null) return;
    const timer = setTimeout(() => {
      setPhase({ kind: 'idle' });
      router.refresh();
    }, cooldownMs);
    return () => clearTimeout(timer);
  }, [cooldownMs, router]);

  // Leaving is safe: the record stays resumable, the page shows Continue. The
  // inline flow has no close of its own, so the page offers one.
  const leave = () => {
    setPhase({ kind: 'idle' });
    router.refresh();
  };

  if (phase.kind === 'inquiry') {
    return (
      <>
        {header}

        {/* Persona asks for at least 650×400 and calls the inline flow a desktop
            flow. Below `sm` the frame takes the whole viewport — a phone cannot
            fit the capture UI inside a padded column — and above it a fixed
            650 px box as wide as the step's column, under Persona's 768 px
            maximum. persona-react renders a bare iframe whose frame props
            only set max-*, so the container sizes it and the iframe fills the
            container. */}
        <div className="fixed inset-0 z-50 flex flex-col bg-surface-base sm:static sm:z-auto sm:gap-4 sm:bg-transparent">
          <div className="flex items-center justify-between px-4 py-2 sm:hidden">
            <span className="text-small font-medium text-primary">{frameTitle}</span>
            <Button variant="ghost-light" size="s" onPress={leave}>
              Finish later
            </Button>
          </div>

          <div
            ref={frameRef}
            tabIndex={-1}
            aria-label={frameTitle}
            className="relative flex-1 overflow-hidden bg-surface-base outline-none sm:h-[650px] sm:flex-none sm:rounded-2xl sm:border sm:border-default [&>iframe]:block [&>iframe]:size-full"
          >
            {/* Visual only: it must never sit between the pointer and a frame that loaded but did not say so. */}
            {!frameReady ? (
              <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Spinner aria-hidden="true" className="size-6 animate-spin text-icon-default" />
                <span className="sr-only">Loading the verification flow</span>
              </div>
            ) : null}
            <PersonaInquiry
              inquiryId={phase.inquiryId}
              sessionToken={phase.sessionToken}
              environmentId={env.NEXT_PUBLIC_PERSONA_ENVIRONMENT_ID}
              frameHeight="100%"
              frameWidth="100%"
              iframeTitle={frameTitle}
              onReady={() => setFrameReady(true)}
              onComplete={() => {
                forgetSessionToken(phase.inquiryId);
                setPhase({ kind: 'submitted' });
                router.refresh();
              }}
              // Functional update on purpose — persona-react registers callbacks
              // once, and a cancel that trails a completion must not downgrade it.
              onCancel={() => {
                setPhase((current) => (current.kind === 'submitted' ? current : { kind: 'idle' }));
                router.refresh();
              }}
              onError={(error) => {
                // Persona: camera_error "is noisy … treat it as a signal for
                // monitoring rather than a hard error". Persona's own UI shows
                // the recovery; unmounting the frame would only add a Retry.
                // (Documented at docs.withpersona.com; the SDK's typings lag.)
                const code: string = error.code;
                if (code === 'camera_error') {
                  Sentry.addBreadcrumb({ category: 'kyc', message: 'Persona camera_error', level: 'info' });
                  return;
                }
                // Any other error ends this session's usefulness: the token is
                // forgotten, so the next Continue goes through the server. A stored session
                // Persona no longer honours — it ended, or the inquiry moved on
                // — is resumed without a click; a fresh one refused the same way
                // is an error.
                forgetSessionToken(phase.inquiryId);
                if (code === 'unauthenticated' && phase.reused) {
                  Sentry.addBreadcrumb({
                    category: 'kyc',
                    message: 'Stored Persona session refused; resuming',
                    level: 'info'
                  });
                  void start();
                  return;
                }
                Sentry.captureException(new Error(`Persona inline flow error: ${error.code}`), {
                  tags: { source: 'CLIENT', flow: 'kyc-inquiry' },
                  extra: { inquiryId: phase.inquiryId, code: error.code, status: error.status }
                });
                setPhase({ kind: 'error', message: 'Something went wrong in the verification flow.' });
              }}
            />
          </div>

          <Button variant="link-primary" size="s" onPress={leave} className="hidden self-start sm:inline-flex">
            Finish later
          </Button>
        </div>
      </>
    );
  }

  // Optimistic "processing" until the server has caught up with the submission.
  if (phase.kind === 'submitted' && serverStillPreSubmission) {
    return (
      <>
        {header}
        <VerificationStatusView
          view={{ ...view, status: 'submitted', canStart: false, canResume: false, inquiryId: null }}
        />
      </>
    );
  }

  // A refused action cannot be retried. A full reload is the fallback if the refresh stalls.
  if (phase.kind === 'refused' && beginAction) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-6">
          <Callout variant="warning" role="alert">
            {START_REFUSAL_COPY[phase.code]}
          </Callout>
          <Button variant="border-light" className="self-start" onPress={() => window.location.reload()}>
            Refresh status
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      <div className="flex flex-col gap-6">
        {phase.kind === 'cooldown' ? (
          <Callout variant="warning" role="status">
            {phase.message}
          </Callout>
        ) : null}

        {/* The button below is the retry: it calls start again, which resumes the same inquiry. */}
        {phase.kind === 'error' ? (
          <Callout variant="warning" role="alert">
            {phase.message}
          </Callout>
        ) : null}

        {/* When there is something to do: what the flow needs, each ticked off, then the state (Verify
            becomes Continue after a start, so it is live, like the status card) and Start or Continue. Every
            other state is the status card alone. */}
        {beginAction ? (
          <div className="flex flex-col gap-11">
            <div role="group" aria-label="What you'll need" className="flex flex-col gap-4">
              {requirements.map((requirement) => (
                <RequirementCard
                  key={requirement.id}
                  requirement={requirement}
                  isSelected={ticked.has(requirement.id)}
                  isDisabled={phase.kind === 'starting'}
                  onChange={(isSelected) =>
                    setTicked((current) => {
                      const next = new Set(current);
                      if (isSelected) next.add(requirement.id);
                      else next.delete(requirement.id);
                      return next;
                    })
                  }
                />
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <p role="status" className="text-small text-secondary">
                {presentation.body}
              </p>
              <Button
                variant="primary"
                onPress={start}
                isPending={phase.kind === 'starting'}
                isDisabled={phase.kind === 'cooldown' || !isReady}
                pendingContent="Preparing…"
                fullWidth
              >
                {beginAction.label}
              </Button>
            </div>
          </div>
        ) : (
          <VerificationStatusView view={view} />
        )}
      </div>
    </>
  );
}

/** One thing to have ready, as a card the whole of which ticks it; the title names the checkbox, the rest describes it. */
function RequirementCard({
  requirement: { title, description, Icon },
  isSelected,
  isDisabled,
  onChange
}: {
  requirement: VerificationRequirement;
  isSelected: boolean;
  isDisabled: boolean;
  onChange: (isSelected: boolean) => void;
}) {
  const id = useId();
  return (
    <Checkbox
      isSelected={isSelected}
      isDisabled={isDisabled}
      onChange={onChange}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      className="items-start gap-x-4 rounded-2xl border border-default bg-surface-elevated p-5 leading-normal font-normal break-normal transition-colors data-selected:border-primary-subtle sm:gap-x-5 sm:p-6"
    >
      <span className="flex min-w-0 flex-col gap-2">
        <span className="flex items-center gap-3">
          <Icon aria-hidden="true" className="size-5 shrink-0 text-icon-default" />
          <span id={`${id}-title`} className="text-leading font-medium text-primary">
            {title}
          </span>
        </span>
        <span id={`${id}-description`} className="text-small text-secondary">
          {description}
        </span>
      </span>
    </Checkbox>
  );
}
