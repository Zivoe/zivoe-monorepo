import { type KycStatusView, type StartRefusal } from '@/server/kyc/kyc-status';

import { EMAILS } from '@/lib/emails';

// Every user-facing word about a Verification Status lives here, so the
// status card and the page's own button never disagree about what a status
// means. Imports nothing from `@/server` (kyc-status.ts is the
// vocabulary, not the wiring) and nothing heavy, so client trees can render it.

export type KycStatusPresentation = {
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

export function presentKycStatus(view: KycStatusView): KycStatusPresentation {
  if (view.path === 'organization') {
    if (view.status === 'approved' || view.status === 'manually_approved') {
      return {
        tone: 'success',
        title: 'Identity verified',
        body: 'Your organization is verified.',
        action: { kind: 'none' }
      };
    }
    // The only other statuses a human sets for an organization; both end at the team.
    if (view.status === 'revoked') {
      return {
        tone: 'alert',
        title: 'Verification revoked',
        body: "Your organization's verification is no longer active. Our team can tell you what happens next.",
        action: TEAM
      };
    }
    if (view.status === 'declined') {
      return {
        tone: 'alert',
        title: 'Verification declined',
        body: 'We were unable to verify your organization. Our team can tell you what happens next.',
        action: TEAM
      };
    }
    return {
      tone: 'neutral',
      title: 'Verify your organization',
      body: 'Entity verification is handled directly with the Zivoe team rather than through the individual ID flow.',
      action: TEAM
    };
  }

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

/** What the page says when a start is refused — one sentence per `StartKycError` code. */
export const START_REFUSAL_COPY: Record<
  StartRefusal | 'organization' | 'profile_missing' | 'persona_unavailable',
  string
> = {
  awaiting_decision: 'Your verification has been received and is awaiting a decision. We will email you when it is in.',
  already_verified: 'Your identity is already verified — there is nothing more to do.',
  declined: 'Your verification was declined. If you believe this is a mistake, contact support and the team will help.',
  revoked: 'Your verification is no longer active. Contact support to find out what happens next.',
  organization: 'Organizations are verified directly with the Zivoe team rather than through this flow.',
  profile_missing: 'Complete onboarding before verifying your identity.',
  persona_unavailable: 'Identity verification is temporarily unavailable. Please try again in a few minutes.'
};
