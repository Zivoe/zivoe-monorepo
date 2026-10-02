// @vitest-environment jsdom
import { render } from '@react-email/components';
import { describe, expect, it } from 'vitest';

import KycActionRequiredEmail from './kyc-action-required-email';
import KycApprovedEmail from './kyc-approved-email';
import KycDeclinedEmail from './kyc-declined-email';
import KycUnderReviewEmail from './kyc-under-review-email';

const KYC_URL = 'https://app.zivoe.com/verification';

describe('KYC status emails', () => {
  it.each([
    ['approved', KycApprovedEmail({ name: 'Ada', kycUrl: KYC_URL })],
    ['declined', KycDeclinedEmail({ name: 'Ada', kycUrl: KYC_URL })],
    ['under review', KycUnderReviewEmail({ kycUrl: KYC_URL })],
    ['action required (expired)', KycActionRequiredEmail({ kycUrl: KYC_URL })]
  ])('%s renders and links to the verification page with no token', async (_label, template) => {
    const html = await render(template);

    expect(html).toContain(`href="${KYC_URL}"`);
    // Transactional: no unsubscribe link and no marketing disclosure.
    expect(html).not.toMatch(/unsubscribe/i);
    expect(html).not.toMatch(/token=/);
  });
});
