import { type StartRefusal, type VerificationStatusView } from '@/server/verification/verification-status';

import { EMAILS } from '@/lib/emails';

// Every user-facing word about a Verification Status lives here, so the
// status card and the page's own button never disagree about what a status
// means. Imports nothing from `@/server` (verification-status.ts is the
// vocabulary, not the wiring) and nothing heavy, so client trees can render it.

export type VerificationStatusPresentation = {
  tone: 'neutral' | 'progress' | 'success' | 'warning' | 'alert';
  title: string;
  body: string;
  action:
    | { kind: 'start'; label: string }
    | { kind: 'resume'; label: string }
    | { kind: 'support'; label: string; href: string }
    | { kind: 'none' };
};

const SUPPORT = { kind: 'support', label: 'Contact support', href: `mailto:${EMAILS.INQUIRE}` } as const;
const TEAM = { kind: 'support', label: 'Contact the team', href: `mailto:${EMAILS.INQUIRE}` } as const;

export function presentVerificationStatus(view: VerificationStatusView): VerificationStatusPresentation {
  if (view.path === 'organization') return presentOrganizationStatus(view);

  switch (view.status) {
    // Start and Continue are the page's action card: the title and body sit
    // above its checklist and button, so neither repeats what the checklist
    // says (the ID, the camera, the minutes) or what the page header says (why).
    case 'not_started':
      return {
        tone: 'neutral',
        title: 'Verify your identity',
        body: 'The flow runs right here on this page.',
        action: { kind: 'start', label: 'Verify identity' }
      };
    case 'in_progress':
    case 'expired':
      return {
        tone: 'progress',
        title: 'Continue your verification',
        body: 'You started verifying your identity. Pick up where you left off, right here on this page.',
        action: { kind: 'resume', label: 'Continue verification' }
      };
    // A failure is Persona's to decide — the Inquiry Failed Workflow moves it
    // on within seconds — never the investor's to retry, so it reads as
    // processing until that decision lands.
    case 'submitted':
    case 'failed':
      return {
        tone: 'progress',
        title: 'Verification processing',
        body: 'We have received your verification and are waiting for the result. We will email you as soon as it is in.',
        action: { kind: 'none' }
      };
    case 'pending_review':
      return {
        tone: 'progress',
        title: 'Verification under review',
        body: 'A member of our team is reviewing your verification. We will email you when a decision is made.',
        action: { kind: 'none' }
      };
    // Kept for the exhaustive switch only: a yes Decision lands on the
    // Wallets step, so nothing renders this card for one any more.
    case 'approved':
    case 'manually_approved':
      return {
        tone: 'success',
        title: 'Identity verified',
        body: 'Your identity is verified.',
        action: { kind: 'none' }
      };
    case 'declined':
      return {
        tone: 'alert',
        title: 'Verification declined',
        body: 'We were unable to approve your verification. If you believe this is a mistake, our team can help.',
        action: SUPPORT
      };
    case 'revoked':
      return {
        tone: 'alert',
        title: 'Verification revoked',
        body: 'Your verification is no longer active. Our team can tell you what happens next.',
        action: SUPPORT
      };
  }
}

/**
 * An organization's states. The flow is the business inquiry, then the KYB
 * case the team decides; while the case waits on the owners the organization
 * listed, the card says so, since that wait is theirs to shorten.
 */
function presentOrganizationStatus(view: VerificationStatusView): VerificationStatusPresentation {
  switch (view.status) {
    case 'not_started':
      return {
        tone: 'neutral',
        title: 'Verify your organization',
        body: 'The flow runs right here on this page.',
        action: { kind: 'start', label: 'Verify organization' }
      };
    case 'in_progress':
    case 'expired':
      return {
        tone: 'progress',
        title: 'Continue your verification',
        body: 'You started verifying your organization. Pick up where you left off, right here on this page.',
        action: { kind: 'resume', label: 'Continue verification' }
      };
    case 'submitted':
      return {
        tone: 'progress',
        title: 'Verification processing',
        body: "We have received your organization's details and are opening the review. We will email you as soon as there is news.",
        action: { kind: 'none' }
      };
    case 'pending_review':
      return {
        tone: 'progress',
        title: 'Verification under review',
        body:
          view.caseWaitingOn === 'people'
            ? 'The owners and control person you listed each need to verify their identity with Persona before our review can finish. We will email you when a decision is made.'
            : "A member of our team is reviewing your organization's verification. We will email you when a decision is made.",
        action: { kind: 'none' }
      };
    // No Workflow decides a failed business inquiry: the team takes it from here.
    case 'failed':
      return {
        tone: 'alert',
        title: 'Verification could not be completed',
        body: "Your organization's verification could not be completed. Our team can tell you what happens next.",
        action: TEAM
      };
    case 'approved':
    case 'manually_approved':
      return {
        tone: 'success',
        title: 'Organization verified',
        body: 'Your organization is verified.',
        action: { kind: 'none' }
      };
    case 'declined':
      return {
        tone: 'alert',
        title: 'Verification declined',
        body: 'We were unable to verify your organization. Our team can tell you what happens next.',
        action: TEAM
      };
    case 'revoked':
      return {
        tone: 'alert',
        title: 'Verification revoked',
        body: "Your organization's verification is no longer active. Our team can tell you what happens next.",
        action: TEAM
      };
  }
}

/** What the page says when a start is refused — one sentence per `StartVerificationError` code. */
export const START_REFUSAL_COPY: Record<
  StartRefusal | 'profile_missing' | 'persona_unavailable' | 'queue_unavailable',
  string
> = {
  awaiting_decision: 'Your verification has been received and is awaiting a decision. We will email you when it is in.',
  already_verified: 'You are already verified. There is nothing more to do.',
  declined: 'Your verification was declined. If you believe this is a mistake, contact support and the team will help.',
  revoked: 'Your verification is no longer active. Contact support to find out what happens next.',
  failed: "Your organization's verification could not be completed. Contact the team to find out what happens next.",
  profile_missing: 'Complete onboarding before verifying.',
  persona_unavailable: 'Verification is temporarily unavailable. Please try again in a few minutes.',
  queue_unavailable: 'Verification is temporarily unavailable. Please try again in a few minutes.'
};
