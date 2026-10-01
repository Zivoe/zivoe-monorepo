import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { personaDriftCheck } from '@/server/kyc';

import { KYC_WEBHOOK_DRIFT_CRON, KYC_WEBHOOK_DRIFT_SLUG, withQstashSignature } from '@/lib/qstash';
import { withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { type ApiResponse } from '../../utils';

// The in-route event whitelist only catches drift that DELIVERS something
// unexpected. The dangerous direction is silence — a webhook disabled,
// narrowed, or mispointed in the dashboard sends nothing to alert on. The
// Drift check reads Persona's registered configuration and diffs it against
// what the code expects; this route runs it daily, on a schedule uncorrelated
// with deploys because dashboard edits are, and turns its report into the
// cron check-in and the captures.
//
// Two Persona reads in sequence, each of which may wait out a 429 for up
// to 5 s and then time out at 15 s: the realistic worst case is past 40 s,
// so the route gets the same minute the sweep has.
export const maxDuration = 60;

const handler = async (
  _req: NextRequest
): ApiResponse<{ checked: boolean; templateChecked: boolean; findings: Array<string> }> => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', KYC_WEBHOOK_DRIFT_SLUG);

  const sentryCheckInId = Sentry.captureCheckIn(
    { monitorSlug: KYC_WEBHOOK_DRIFT_SLUG, status: 'in_progress' },
    { schedule: { type: 'crontab', value: KYC_WEBHOOK_DRIFT_CRON }, checkinMargin: 30, maxRuntime: 2 }
  );

  try {
    const report = await personaDriftCheck.check();

    // Persona being unreachable is its own condition, not drift; the next
    // day's run tries again. Same stance as the sweep's `unavailable`.
    if (!report.reachable) {
      Sentry.captureException(new Error('KYC webhook drift check could not reach Persona'), {
        tags: { source: 'API', flow: KYC_WEBHOOK_DRIFT_SLUG },
        extra: { error: report.unavailable }
      });
      Sentry.captureCheckIn({ checkInId: sentryCheckInId, monitorSlug: KYC_WEBHOOK_DRIFT_SLUG, status: 'ok' });
      return NextResponse.json({ success: true, data: { checked: false, templateChecked: false, findings: [] } });
    }

    // In production the template half of the check is not optional: the pin
    // is what guards against a version published unnoticed, so a run that did
    // not compare it — no template id configured, or a read that failed (a key
    // without inquiry_template.read, say) — must not stay a silent
    // `templateChecked: false` in a response nobody reads. Elsewhere it is the
    // expected answer: Persona does not expose templates to sandbox keys.
    if (!report.templateChecked && env.VERCEL_ENV === 'production') {
      Sentry.captureException(new Error('KYC drift check did not verify the inquiry template version'), {
        tags: {
          source: 'API',
          flow: KYC_WEBHOOK_DRIFT_SLUG,
          reason: report.templateUnavailable?.reason ?? 'not_configured'
        },
        extra: { templateId: env.PERSONA_TEMPLATE_ID ?? null, error: report.templateUnavailable }
      });
    }

    if (report.findings.length > 0) {
      // Grouped by the findings themselves: the same drift every day is one
      // Sentry issue, and a new finding opens (and alerts on) a new one instead
      // of joining an issue already open for a standing finding, such as an
      // attribute blocklist nobody has set yet.
      Sentry.captureException(new Error('Persona webhook configuration drift detected'), {
        tags: { source: 'API', flow: KYC_WEBHOOK_DRIFT_SLUG },
        fingerprint: ['persona-webhook-drift', ...[...report.findings].sort()],
        extra: { endpointUrl: report.endpointUrl, findings: report.findings }
      });
    }

    Sentry.captureCheckIn({ checkInId: sentryCheckInId, monitorSlug: KYC_WEBHOOK_DRIFT_SLUG, status: 'ok' });
    return NextResponse.json({
      success: true,
      data: { checked: true, templateChecked: report.templateChecked, findings: report.findings }
    });
  } catch (error) {
    Sentry.captureCheckIn({ checkInId: sentryCheckInId, monitorSlug: KYC_WEBHOOK_DRIFT_SLUG, status: 'error' });
    throw error;
  } finally {
    await Sentry.flush(2000);
  }
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error running KYC webhook drift check', handler)(req);
});
