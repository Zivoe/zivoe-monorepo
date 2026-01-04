import { NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { Resend } from 'resend';

import { env } from '@/env';

const resend = new Resend(env.RESEND_API_KEY);

type ResendWebhookEvent = {
  type: 'email.bounced' | 'email.complained' | 'email.delivery_delayed' | 'email.failed';
  created_at: string;
  data: {
    created_at: string;
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    /** Present on email.bounced events */
    bounce?: {
      message: string;
      type: 'Permanent' | 'Transient';
      subType?: string;
    };
    /** Present on email.failed events */
    failed?: {
      reason: string;
    };
    /** Custom tags set when sending the email */
    tags?: Record<string, string>;
  };
};

// * Send 200 on errors in order to avoid retries on webhooks
export async function POST(req: NextRequest) {
  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing webhook headers' });
  }

  let event: ResendWebhookEvent;

  // Verify the webhook signature
  try {
    const payload = await req.text();

    event = resend.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature
      },
      webhookSecret: env.RESEND_WEBHOOK_SECRET
    }) as ResendWebhookEvent;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid webhook signature' });
  }

  // Process the verified event
  try {
    const { type, data } = event;
    const recipientEmail = data.to[0];

    // Common extra data for all Sentry reports
    const sentryExtra = {
      svixId,
      emailId: data.email_id,
      subject: data.subject,
      from: data.from,
      to: data.to,
      tags: data.tags
    };

    switch (type) {
      case 'email.bounced': {
        const isPermanent = data.bounce?.type === 'Permanent';
        const bounceSubType = data.bounce?.subType;

        Sentry.captureException(new Error(`Email ${isPermanent ? 'hard' : 'soft'} bounce: ${recipientEmail}`), {
          tags: {
            source: 'SERVER',
            flow: 'email-bounce',
            bounceType: data.bounce?.type ?? 'unknown',
            bounceSubType: bounceSubType ?? 'unknown'
          },
          extra: {
            ...sentryExtra,
            bounceMessage: data.bounce?.message,
            bounceSubType
          }
        });
        break;
      }

      case 'email.complained': {
        // Critical: User marked email as spam
        Sentry.captureException(new Error(`SPAM COMPLAINT: ${recipientEmail}`), {
          tags: {
            source: 'SERVER',
            flow: 'spam-complaint'
          },
          extra: sentryExtra
        });
        break;
      }

      case 'email.delivery_delayed': {
        Sentry.captureException(new Error(`Email delivery delayed: ${recipientEmail}`), {
          tags: {
            source: 'SERVER',
            flow: 'email-delayed'
          },
          extra: sentryExtra
        });
        break;
      }

      case 'email.failed': {
        // Email failed to send (quota, domain issues, invalid recipient, etc.)
        const failReason = data.failed?.reason ?? 'unknown';

        Sentry.captureException(new Error(`Email send failed: ${recipientEmail} - ${failReason}`), {
          tags: {
            source: 'SERVER',
            flow: 'email-failed',
            failReason
          },
          extra: sentryExtra
        });
        break;
      }

      default:
        // Shouldn't happen if webhook subscription is configured correctly
        console.warn(`Unexpected Resend webhook event type: ${type}`);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { source: 'SERVER', flow: 'resend-webhook-processing' },
      extra: { svixId, eventType: event.type }
    });

    return NextResponse.json({ error: 'Processing error' });
  }
}
