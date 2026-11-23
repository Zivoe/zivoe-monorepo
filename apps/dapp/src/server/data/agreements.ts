import 'server-only';

import { cache } from 'react';

import * as Sentry from '@sentry/nextjs';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import { agreementAcceptance, kycVerification, organization, organizationMember } from '@zivoe/database/schema';

import { db } from '@/server/clients/db';
import { YES_DECISION_STATUSES } from '@/server/verification/verification-status';

import { LATEST_AGREEMENTS_VERSION } from '@/lib/agreements';
import { AppError } from '@/lib/utils';

export type AgreementsAccess = {
  /** Against `LATEST_AGREEMENTS_VERSION`: a row for it, rows for earlier versions only, or none. */
  status: 'accepted' | 'outdated' | 'never';
  /** Whether they act for an approved account: their own, or a live organization they belong to. */
  actsForApproved: boolean;
};

/**
 * Where a person stands on the agreements: read by the page gate (`getRequiredStep`, which sends anyone who acts
 * for an approved account without the current version to `/agreements`), by `/verification` to place the Agreements
 * step, and by the wallet-link actions, which link nothing without the current version. Both halves are local,
 * indexed reads (the Decision is the stored verification status, never a Persona call), run together. Cached per
 * server render; never redirects.
 */
export const getAgreementsAccess = cache(async (userId: string): Promise<AgreementsAccess> => {
  try {
    const organizations = db
      .select({ id: organizationMember.organizationId })
      .from(organizationMember)
      .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
      .where(and(eq(organizationMember.userId, userId), isNull(organization.deletedAt)));

    const [[acceptance], approved] = await Promise.all([
      // An aggregate without GROUP BY: always one row, all false for a person with no acceptance.
      db
        .select({
          hasAcceptedLatest: sql<boolean>`coalesce(bool_or(${agreementAcceptance.agreementsVersion} = ${LATEST_AGREEMENTS_VERSION}), false)`,
          hasAcceptedAny: sql<boolean>`count(*) > 0`
        })
        .from(agreementAcceptance)
        .where(eq(agreementAcceptance.userId, userId)),
      db
        .select({ subjectId: kycVerification.subjectId })
        .from(kycVerification)
        .where(
          and(
            inArray(kycVerification.status, [...YES_DECISION_STATUSES]),
            or(eq(kycVerification.subjectId, userId), inArray(kycVerification.subjectId, organizations))
          )
        )
        .limit(1)
    ]);

    return {
      status: acceptance?.hasAcceptedLatest ? 'accepted' : acceptance?.hasAcceptedAny ? 'outdated' : 'never',
      actsForApproved: approved.length > 0
    };
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER', flow: 'verify-agreements' }, extra: { userId } });
    throw new AppError({ message: 'Failed to verify agreements status', type: 'error', capture: false });
  }
});
