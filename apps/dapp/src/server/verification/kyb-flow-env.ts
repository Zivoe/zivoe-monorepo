import { type KybFlowConfig } from './verification';
import { KYB_CASE_STATUS_SETS } from './verification-status';

/** The `PERSONA_KYB_*` group, as the environment hands it over (empty strings read as unset). */
export type KybFlowEnv = Partial<
  Record<
    | 'PERSONA_KYB_TEMPLATE_ID'
    | 'PERSONA_KYB_TEMPLATE_VERSION_ID'
    | 'PERSONA_KYB_ACCOUNT_TYPE_ID'
    | 'PERSONA_KYB_CASE_TEMPLATE_ID',
    string | undefined
  >
>;

/**
 * The organization flow from its environment group: all four ids or none,
 * since a half-set group would silently leave organizations on the team
 * path, so that throws. The case status mappings live in code. Pure, so
 * the sandbox run can read the same group the wiring does.
 */
export function readKybFlowConfig(env: KybFlowEnv | NodeJS.ProcessEnv): KybFlowConfig | undefined {
  const ids = {
    templateId: env.PERSONA_KYB_TEMPLATE_ID,
    templateVersionId: env.PERSONA_KYB_TEMPLATE_VERSION_ID,
    accountTypeId: env.PERSONA_KYB_ACCOUNT_TYPE_ID,
    caseTemplateId: env.PERSONA_KYB_CASE_TEMPLATE_ID
  };
  const set = Object.entries(ids).filter(([, value]) => !!value);
  if (set.length === 0) return undefined;
  if (set.length < Object.keys(ids).length) {
    throw new Error(`PERSONA_KYB_* must be set together; only ${set.map(([key]) => key).join(', ')} is set`);
  }
  return {
    path: 'organization',
    ...(ids as Record<keyof typeof ids, string>),
    caseStatuses: KYB_CASE_STATUS_SETS
  };
}
