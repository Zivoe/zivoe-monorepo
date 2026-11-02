import { describe, expect, it } from 'vitest';

import { readKybFlowConfig } from './kyb-flow-env';
import { KYB_CASE_STATUS_SETS } from './verification-status';

const IDS = {
  PERSONA_KYB_TEMPLATE_ID: 'itmpl_kyb',
  PERSONA_KYB_TEMPLATE_VERSION_ID: 'itmplv_kyb',
  PERSONA_KYB_ACCOUNT_TYPE_ID: 'acttp_business',
  PERSONA_KYB_CASE_TEMPLATE_ID: 'ctmpl_kyb'
};

describe('readKybFlowConfig', () => {
  it('reads nothing as the flow being off', () => {
    expect(readKybFlowConfig({})).toBeUndefined();
  });

  it('refuses a half-set group, naming what is set', () => {
    expect(() => readKybFlowConfig({ PERSONA_KYB_TEMPLATE_ID: 'itmpl_kyb' })).toThrow(/only templateId is set/);
  });

  it('reads the four ids with the fixed published status sets', () => {
    expect(readKybFlowConfig(IDS)).toEqual({
      path: 'organization',
      templateId: 'itmpl_kyb',
      templateVersionId: 'itmplv_kyb',
      accountTypeId: 'acttp_business',
      caseTemplateId: 'ctmpl_kyb',
      caseStatuses: KYB_CASE_STATUS_SETS
    });
  });
});
