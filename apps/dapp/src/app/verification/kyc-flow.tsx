'use client';

import { useEffect, useRef, useState } from 'react';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import * as Sentry from '@sentry/nextjs';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { CameraIcon, ClockIcon, DocumentIcon, Spinner } from '@zivoe/ui/icons';

import { type KycStatusView as KycStatusViewModel } from '@/server/kyc/kyc-status';

import { withNext } from '@/lib/lighthouse';
import { handlePromise } from '@/lib/utils';

import { Auth } from '@/app/(auth)/_components/common';
import { type StartKycErrorResponse, type StartKycResponse } from '@/app/api/kyc/start/route';

import { env } from '@/env';

import { START_REFUSAL_COPY, presentKycStatus } from './kyc-status-copy';
import { KycStatusView } from './kyc-status-view';

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
  | { kind: 'refused'; code: StartKycErrorResponse['code'] }
  /** Another click cannot help yet: no Retry, the button rests, then the view is re-read. */
  | { kind: 'cooldown'; message: string; ms: number }
  | { kind: 'error'; message: string };

const isRefusal = (body: StartKycResponse): body is StartKycErrorResponse => 'code' in body;

/** The page owns the words: a server's error text (a handler's generic message, a 404) never reaches the investor. */
const START_FAILED_COPY = 'Could not start verification. Please try again.';
const START_IN_FLIGHT_COPY = 'A verification is already being started. Try again in a moment.';

export default function KycFlow({
  view,
  onBack
}: {
  view: KycStatusViewModel;
  /** Back to the Investor Profile step; offered while nothing is in flight. */
  onBack?: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
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

  const presentation = presentKycStatus(view);
  // Start / Continue, when the view allows either; the copy module derives it from the same domain facts.
  const { action } = presentation;
  const beginAction = action.kind === 'start' || action.kind === 'resume' ? action : null;

  // The step's header, above every phase. Back is withheld while a start is
  // in flight, the frame is up, or a submission is being confirmed — there is
  // nothing to go back for then, and leaving would only lose the answer.
  const canLeaveStep = phase.kind !== 'starting' && phase.kind !== 'inquiry' && phase.kind !== 'submitted';
  const header = (
    <Auth.Header
      title="Identity verification"
      description="Vaults accept deposits from verified investors. Verification is handled securely by Persona; Zivoe keeps only your verification status, never your documents."
    >
      <Auth.StepIndicator onBack={onBack && canLeaveStep ? onBack : undefined}>Step 2 of 2</Auth.StepIndicator>
    </Auth.Header>
  );

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
    const { res, err } = await handlePromise(fetch('/api/kyc/start', { method: 'POST' }));
    const body = res ? ((await handlePromise(res.json())).res as StartKycResponse | undefined) : undefined;

    if (err || !body) {
      setPhase({ kind: 'error', message: START_FAILED_COPY });
    } else if (isRefusal(body) && body.code === 'persona_unavailable') {
      // Not a state change: the server is already capturing it, and the page rests before the next try.
      setPhase({
        kind: 'cooldown',
        message: START_REFUSAL_COPY.persona_unavailable,
        ms: PERSONA_UNAVAILABLE_COOLDOWN_MS
      });
    } else if (isRefusal(body)) {
      setPhase({ kind: 'refused', code: body.code });
      // A refusal is the server's answer about a state this page rendered
      // before it existed (approved by a webhook since load, say): refresh so
      // the card and the button beneath the callout agree with it.
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
      router.push(withNext('/sign-in', '/verification'));
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
            <span className="text-small font-medium text-primary">Identity verification</span>
            <Button variant="ghost-light" size="s" onPress={leave}>
              Finish later
            </Button>
          </div>

          <div
            ref={frameRef}
            tabIndex={-1}
            aria-label="Identity verification"
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
              iframeTitle="Verify your identity"
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
        <KycStatusView view={{ ...view, status: 'submitted', canStart: false, canResume: false, inquiryId: null }} />
      </>
    );
  }

  return (
    <>
      {header}

      <div className="flex flex-col gap-6">
        {/* Only until the refresh lands: from then on the card below names the state the refusal was about. */}
        {phase.kind === 'refused' && beginAction ? (
          <Callout variant="warning" role="alert">
            {START_REFUSAL_COPY[phase.code]}
          </Callout>
        ) : null}

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

        {/* One card when there is something to do — the state's title, what
            the flow needs, and Start or Continue — so the state and the
            checklist never say the same thing twice. Every other state is the
            status card alone. */}
        {beginAction ? (
          <div className="flex flex-col gap-6 rounded-2xl border border-default bg-surface-elevated p-6">
            {/* The part that changes with the record (Verify becomes Continue after a start): live, like the status card. */}
            <div role="status" className="flex flex-col gap-1">
              <h2 className="font-paragraph! text-leading font-medium text-primary">{presentation.title}</h2>
              <p className="text-small text-secondary">{presentation.body}</p>
            </div>

            <ul aria-label="What you'll need" className="flex flex-col gap-3 text-regular text-primary">
              <li className="flex items-start gap-3">
                <DocumentIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-icon-default" />A
                government-issued photo ID (passport, driver&apos;s license or national ID)
              </li>
              <li className="flex items-start gap-3">
                <CameraIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-icon-default" />A device with a
                camera, for a quick selfie
              </li>
              <li className="flex items-start gap-3">
                <ClockIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-icon-default" />
                About five minutes
              </li>
            </ul>

            <Button
              variant="primary"
              onPress={start}
              isPending={phase.kind === 'starting'}
              isDisabled={phase.kind === 'cooldown'}
              pendingContent="Preparing…"
              fullWidth
            >
              {beginAction.label}
            </Button>
          </div>
        ) : (
          <KycStatusView view={view} />
        )}
      </div>
    </>
  );
}
