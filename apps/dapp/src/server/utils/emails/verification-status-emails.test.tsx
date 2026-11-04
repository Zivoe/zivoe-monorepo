// @vitest-environment jsdom
import { render } from '@react-email/components';
import { describe, expect, it } from 'vitest';

import VerificationActionRequiredEmail from './verification-action-required-email';
import VerificationApprovedEmail from './verification-approved-email';
import VerificationDeclinedEmail from './verification-declined-email';
import VerificationFailedEmail from './verification-failed-email';
import VerificationReopenedEmail from './verification-reopened-email';
import VerificationUnderReviewEmail from './verification-under-review-email';

const VERIFICATION_URL = 'https://app.zivoe.com/verification';
const TEMPLATES = [
  ['approved', VerificationApprovedEmail],
  ['declined', VerificationDeclinedEmail],
  ['under review', VerificationUnderReviewEmail],
  ['action required (expired)', VerificationActionRequiredEmail],
  ['failed (organizations only)', VerificationFailedEmail]
] as const;

describe('Verification status emails', () => {
  it.each(TEMPLATES)('%s renders and links to the verification page with no token', async (_label, Template) => {
    const html = await render(Template({ name: 'Ada', verificationUrl: VERIFICATION_URL, accountType: 'individual' }));

    expect(html).toContain(`href="${VERIFICATION_URL}"`);
    // Transactional: no unsubscribe link and no marketing disclosure.
    expect(html).not.toMatch(/unsubscribe/i);
    expect(html).not.toMatch(/token=/);
  });

  it('tells a reopened organization that its wallets stop after an approval, and that nothing is needed after a decline', async () => {
    const reopened = (previousDecision: 'approved' | 'declined') =>
      render(
        VerificationReopenedEmail({
          name: 'Grace',
          verificationUrl: VERIFICATION_URL,
          accountType: 'organization',
          previousDecision
        })
      );

    const afterApproval = await reopened('approved');
    expect(afterApproval).toContain('taking another look at your organization');
    expect(afterApproval).toContain(`href="${VERIFICATION_URL}"`);
    expect(afterApproval).toContain('removed from the whitelist');
    expect(afterApproval).not.toMatch(/unsubscribe/i);

    const afterDecline = await reopened('declined');
    expect(afterDecline).toContain('nothing you need to do');
    expect(afterDecline).not.toContain('whitelist');
  });

  it('tells a declined investor their wallets stop only when the decline reversed an approval', async () => {
    const declined = (previousDecision?: 'approved') =>
      render(
        VerificationDeclinedEmail({
          name: 'Ada',
          verificationUrl: VERIFICATION_URL,
          accountType: 'individual',
          previousDecision
        })
      );

    expect(await declined('approved')).toContain('removed from the whitelist');
    expect(await declined()).not.toContain('whitelist');
  });

  it('tells an approved investor the wallet step is what remains', async () => {
    const html = await render(
      VerificationApprovedEmail({ name: 'Ada', verificationUrl: VERIFICATION_URL, accountType: 'individual' })
    );

    expect(html).toContain('Connect your wallet');
    expect(html).toContain('request its whitelist');
  });

  it.each(TEMPLATES)(
    '%s speaks of the organization, never of an identity, to an organization',
    async (_label, Template) => {
      const html = await render(
        Template({ name: 'Grace', verificationUrl: VERIFICATION_URL, accountType: 'organization' })
      );

      expect(html).toMatch(/your organization/i);
      expect(html).not.toMatch(/your identity/i);
    }
  );

  it('tells an organization whose case waits on its people that they have seven days, and one on the team that it is being reviewed', async () => {
    const people = await render(
      VerificationUnderReviewEmail({
        verificationUrl: VERIFICATION_URL,
        accountType: 'organization',
        caseWaitingOn: 'people'
      })
    );
    expect(people).toContain('email from Persona');
    expect(people).toContain('seven days');
    expect(people).not.toContain('reviewing it now');

    const team = await render(
      VerificationUnderReviewEmail({
        verificationUrl: VERIFICATION_URL,
        accountType: 'organization',
        caseWaitingOn: 'team'
      })
    );
    expect(team).toContain('reviewing it now');
    expect(team).not.toContain('seven days');
  });
});
