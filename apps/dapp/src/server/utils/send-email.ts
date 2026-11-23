import 'server-only';

import { type ReactElement } from 'react';

import { render } from '@react-email/components';
import { Resend } from 'resend';

import { type SubjectKind } from '@zivoe/database/organizations';

import { isOneLine, readsAsLink } from '@/lib/schemas/reads-as-link';
import { EMAILS } from '@/lib/utils';

import { env } from '@/env';

import { type DecisionStatus, type VerificationEmailStatus } from '../verification/verification-status';
import { BASE_URL } from './base-url';
import { buildTransactionReceiptEmail } from './centrifuge-tx-receipt-email';
import { type TransactionReceiptJob, buildReceiptJobKey } from './centrifuge-tx-receipt-job';
import AddressWhitelistedEmail from './emails/address-whitelisted-email';
import FirstDepositReminderEmail from './emails/first-deposit-reminder-email';
import OnboardingReminderEmail from './emails/onboarding-reminder-email';
import OrganizationInvitationEmail from './emails/organization-invitation-email';
import OrganizationMemberRemovedEmail from './emails/organization-member-removed-email';
import OTPEmail from './emails/otp-email';
import SecondDepositReminderEmail from './emails/second-deposit-reminder-email';
import VerificationActionRequiredEmail from './emails/verification-action-required-email';
import VerificationApprovedEmail from './emails/verification-approved-email';
import VerificationDeclinedEmail from './emails/verification-declined-email';
import VerificationFailedEmail from './emails/verification-failed-email';
import VerificationReopenedEmail from './emails/verification-reopened-email';
import VerificationUnderReviewEmail from './emails/verification-under-review-email';
import WelcomeEmail from './emails/welcome-email';
import { buildOneClickUnsubscribeUrl, buildUnsubscribeUrl } from './unsubscribe';

const resend = new Resend(env.RESEND_API_KEY);
const PRODUCT_TIPS_LIST_ID = 'Product Tips <product-tips.zivoe.com>';

export async function sendOTPEmail({ to, otp }: { to: string; otp: string }) {
  const html = await render(OTPEmail({ otp }));

  const { data, error } = await resend.emails.send({
    from: 'Zivoe <verify@auth.zivoe.com>',
    replyTo: EMAILS.INQUIRE,
    to,
    subject: 'Sign in to Zivoe',
    html
  });

  if (error) throw new Error(error.message, { cause: error });

  return { data };
}

export async function sendOnboardingReminderEmail({ to, name, userId }: { to: string; name?: string; userId: string }) {
  const { footerUnsubscribeUrl, oneClickHeaders } = getProductTipsUnsubscribeMetadata({ userId, email: to });
  const html = await render(OnboardingReminderEmail({ name, unsubscribeUrl: footerUnsubscribeUrl }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject: 'Need help completing your Zivoe onboarding?',
        html,
        headers: oneClickHeaders
      },
      {
        idempotencyKey: `onboarding-reminder-email/${userId}`
      }
    )
  );
}

export async function sendWelcomeEmail({ to, name, userId }: { to: string; name?: string; userId: string }) {
  const { footerUnsubscribeUrl, oneClickHeaders } = getProductTipsUnsubscribeMetadata({ userId, email: to });
  const html = await render(WelcomeEmail({ name, unsubscribeUrl: footerUnsubscribeUrl }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject: 'Welcome to Zivoe',
        html,
        headers: oneClickHeaders
      },
      {
        idempotencyKey: `welcome-email/${userId}`
      }
    )
  );
}

export async function sendFirstDepositReminderEmail({
  to,
  name,
  userId
}: {
  to: string;
  name?: string;
  userId: string;
}) {
  const { footerUnsubscribeUrl, oneClickHeaders } = getProductTipsUnsubscribeMetadata({ userId, email: to });
  const html = await render(FirstDepositReminderEmail({ name, unsubscribeUrl: footerUnsubscribeUrl }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject: 'Ready to put your stablecoins to work?',
        html,
        headers: oneClickHeaders
      },
      {
        idempotencyKey: `first-deposit-reminder-email/${userId}`
      }
    )
  );
}

export async function sendSecondDepositReminderEmail({
  to,
  name,
  userId
}: {
  to: string;
  name?: string;
  userId: string;
}) {
  const { footerUnsubscribeUrl, oneClickHeaders } = getProductTipsUnsubscribeMetadata({ userId, email: to });
  const html = await render(SecondDepositReminderEmail({ name, unsubscribeUrl: footerUnsubscribeUrl }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject: 'Still interested in Zivoe?',
        html,
        headers: oneClickHeaders
      },
      {
        idempotencyKey: `second-deposit-reminder-email/${userId}`
      }
    )
  );
}

/**
 * One transaction receipt to one linked user. Plain transactional mail from
 * the neutral sender — no persona, no List-Unsubscribe headers (those are the
 * bulk buckets' concern); the footer unsubscribe drives the
 * transaction_receipts preference. Resend's idempotency key (kept 24 hours)
 * absorbs the crash-between-send-and-record replay the DB dedupe cannot see.
 */
export async function sendTransactionReceiptEmail({
  to,
  userId,
  job,
  symbol,
  shareDecimals,
  viewInAppUrl
}: {
  to: string;
  userId: string;
  job: TransactionReceiptJob;
  symbol: string;
  shareDecimals: number;
  viewInAppUrl: string;
}) {
  const unsubscribeUrl = buildUnsubscribeUrl({ userId, email: to, bucket: 'transaction_receipts' });
  const { subject, email } = buildTransactionReceiptEmail({ job, symbol, shareDecimals, viewInAppUrl, unsubscribeUrl });
  const html = await render(email);
  const receiptKey = buildReceiptJobKey({ eventId: job.eventId, userId });

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject,
        html,
        // Attribution for the Resend webhook, which forwards tags to Sentry:
        // the only way to tie a bounce or complaint back to one receipt.
        tags: [
          { name: 'flow', value: 'transaction-receipt' },
          { name: 'event_type', value: job.event.type },
          { name: 'receipt_key', value: receiptKey }
        ]
      },
      {
        idempotencyKey: `transaction-receipt/${receiptKey}`
      }
    )
  );
}

/**
 * One subject and template per emailable status — the table a reviewer scans
 * against the page copy. An organization reads about its organization where
 * an individual reads about their identity.
 */
const VERIFICATION_EMAILS: Record<
  VerificationEmailStatus,
  {
    subject: Record<SubjectKind, string>;
    render: (props: {
      name?: string;
      verificationUrl: string;
      subjectKind: SubjectKind;
      organizationName: string | null;
      caseWaitingOn: 'people' | 'team' | null;
      /** The Decision a reversal took back, when the email announces one. */
      previousDecision?: DecisionStatus;
    }) => ReactElement;
  }
> = {
  approved: {
    subject: { individual: 'Your identity is verified', organization: 'Your organization is verified' },
    render: (props) => VerificationApprovedEmail(props)
  },
  declined: {
    subject: {
      individual: 'An update on your identity verification',
      organization: "An update on your organization's verification"
    },
    render: (props) => VerificationDeclinedEmail(props)
  },
  pending_review: {
    subject: {
      individual: 'Your identity verification is under review',
      organization: "Your organization's verification is under review"
    },
    render: (props) => VerificationUnderReviewEmail(props)
  },
  expired: {
    subject: {
      individual: 'Finish your identity verification',
      organization: "Finish your organization's verification"
    },
    render: (props) => VerificationActionRequiredEmail(props)
  },
  failed: {
    subject: {
      individual: 'An update on your identity verification',
      organization: "Your organization's verification could not be completed"
    },
    render: (props) => VerificationFailedEmail(props)
  }
};

/** A review that is a reopen reads differently: a Decision was taken back, nothing was just completed. */
const VERIFICATION_REOPENED_SUBJECTS: Record<SubjectKind, string> = {
  individual: "We're taking another look at your identity verification",
  organization: "We're taking another look at your organization's verification"
};

/**
 * One status email per outcome, from the transactional sender (like the OTP
 * email): no unsubscribe metadata, since a compliance decision about a person
 * must never be withheld. Idempotent per transition (status, inquiry and when
 * it changed) on Resend's side, so a status reached a second time is emailed.
 */
export async function sendVerificationStatusEmail({
  to,
  name,
  status,
  subjectId,
  subjectKind,
  organizationName,
  caseWaitingOn,
  previousDecision,
  inquiryId,
  statusChangedAt
}: {
  to: string;
  name?: string;
  status: VerificationEmailStatus;
  subjectId: string;
  subjectKind: SubjectKind;
  organizationName: string | null;
  caseWaitingOn: 'people' | 'team' | null;
  previousDecision?: DecisionStatus;
  inquiryId: string;
  statusChangedAt: Date;
}) {
  // `/verification` alone opens on the reader; an organization's email names the organization, so a member
  // never acts (or links a wallet) for themselves while reading about it.
  const verificationUrl =
    subjectKind === 'organization' ? `${BASE_URL}/verification?subject=${subjectId}` : `${BASE_URL}/verification`;
  const reopen = status === 'pending_review' && previousDecision;
  const baseSubject = reopen
    ? VERIFICATION_REOPENED_SUBJECTS[subjectKind]
    : VERIFICATION_EMAILS[status].subject[subjectKind];
  // Someone can belong to several organizations: the inbox says which one, when the name is safe in a subject line.
  const subject =
    subjectKind === 'organization' && organizationName && isOneLine(organizationName) && !readsAsLink(organizationName)
      ? `${baseSubject}: ${organizationName}`
      : baseSubject;
  const html = await render(
    reopen
      ? VerificationReopenedEmail({ name, verificationUrl, subjectKind, organizationName, previousDecision })
      : VERIFICATION_EMAILS[status].render({
          name,
          verificationUrl,
          subjectKind,
          organizationName,
          caseWaitingOn,
          previousDecision
        })
  );

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Zivoe <verify@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject,
        html
      },
      {
        idempotencyKey: `kyc-${status}-email/${inquiryId}/${statusChangedAt.getTime()}`
      }
    )
  );
}

/**
 * The Wallet link's one email, from the transactional sender like the verification
 * status emails: a whitelisted address is a fact about the person's account,
 * never withheld. Idempotent per (link, `whitelistObservedAt`) on Resend's side,
 * so a redelivered job sends once; the stamp is set once per Whitelist request, so each is emailed once.
 */
export async function sendAddressWhitelistedEmail({
  to,
  name,
  address,
  linkId,
  whitelistObservedAt
}: {
  to: string;
  name: string | null;
  address: string;
  linkId: string;
  whitelistObservedAt: Date;
}) {
  const html = await render(AddressWhitelistedEmail({ name: name ?? undefined, address, vaultsUrl: `${BASE_URL}/` }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Zivoe <verify@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject: 'Your address is whitelisted',
        html
      },
      {
        idempotencyKey: `wallet-link-whitelisted-email/${linkId}/${whitelistObservedAt.getTime()}`
      }
    )
  );
}

/**
 * Maps Resend's idempotency answers onto "sent". `invalid_idempotent_request`
 * means the key is already bound to an earlier request with a different body
 * — and every retry here has a different body, because the unsubscribe token
 * carries its issue time — so it is the signature of a replay after a send.
 * `concurrent_idempotent_requests` means another delivery holds the key right
 * now and may still fail; Resend's guidance is to retry later, so it throws
 * and the queue's retry lands after that request has settled.
 */
export function handleIdempotentResult<T>({
  data,
  error
}: {
  data: T | null;
  error: { name: string; message: string } | null;
}): { data: T | null } {
  if (error) {
    if (error.name === 'invalid_idempotent_request') return { data: null };
    throw new Error(error.message, { cause: error });
  }
  return { data };
}

function getProductTipsUnsubscribeMetadata({ userId, email }: { userId: string; email: string }) {
  const footerUnsubscribeUrl = buildUnsubscribeUrl({ userId, email, bucket: 'product_tips' });
  const oneClickUnsubscribeUrl = buildOneClickUnsubscribeUrl({ userId, email });

  return {
    footerUnsubscribeUrl,
    oneClickHeaders: {
      'List-Id': PRODUCT_TIPS_LIST_ID,
      'List-Unsubscribe': `<${oneClickUnsubscribeUrl}>, <mailto:${EMAILS.INQUIRE}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  };
}

/** An email's plain-text part. Headings keep their case: they carry names, which are not ours to change. */
const renderText = (email: ReactElement) =>
  render(email, {
    plainText: true,
    htmlToTextOptions: {
      selectors: ['h1', 'h2', 'h3'].map((selector) => ({ selector, options: { uppercase: false } }))
    }
  });

/** At most `length` characters a reader sees (emoji and accents whole), with an ellipsis when cut. */
const clip = (text: string, length = 60) => {
  const characters = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)].map(
    ({ segment }) => segment
  );
  return characters.length > length
    ? `${characters
        .slice(0, length - 1)
        .join('')
        .trimEnd()}…`
    : text;
};

/**
 * An invitation to join an organization, one per send, with a plain-text part. No unsubscribe
 * metadata: it is one message someone asked to send, the invitation ends on its own, and no
 * reminders ever follow it. The subject names who asked, clipped: names can be long.
 */
export async function sendOrganizationInvitationEmail({
  to,
  invitationId,
  sendCount,
  organizationName,
  inviterName,
  inviterEmail,
  expiresAt
}: {
  to: string;
  invitationId: string;
  sendCount: number;
  organizationName: string;
  inviterName: string;
  inviterEmail: string | null;
  expiresAt: Date;
}) {
  const email = OrganizationInvitationEmail({
    organizationName,
    inviterName,
    inviterEmail,
    expiresAt,
    invitationUrl: `${BASE_URL}/invitations/${invitationId}`
  });
  const [html, text] = await Promise.all([render(email), renderText(email)]);

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Zivoe <verify@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject: `${clip(inviterName)} invited you to join ${clip(organizationName)} on Zivoe`,
        html,
        text,
        tags: [{ name: 'category', value: 'organization_invitation' }]
      },
      { idempotencyKey: `organization-invitation/${invitationId}/${sendCount}` }
    )
  );
}

/** Tells someone another member took them out of an organization: how a removal they did not expect gets noticed. */
export async function sendOrganizationMemberRemovedEmail({
  to,
  name,
  organizationName,
  removedByName,
  removalKey
}: {
  to: string;
  name: string | null;
  organizationName: string;
  removedByName: string;
  removalKey: string;
}) {
  const email = OrganizationMemberRemovedEmail({ name, organizationName, removedByName, supportEmail: EMAILS.INQUIRE });
  const [html, text] = await Promise.all([render(email), renderText(email)]);

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Zivoe <verify@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject: `You were removed from ${clip(organizationName)} on Zivoe`,
        html,
        text,
        tags: [{ name: 'category', value: 'organization_member_removed' }]
      },
      { idempotencyKey: `organization-member-removed/${removalKey}` }
    )
  );
}
