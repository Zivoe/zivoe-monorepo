/**
 * The identity the dapp's agent sign-in signs in as (apps/dapp/src/app/api/agent-sign-in),
 * so an AI agent driving a browser can reach the signed-in dapp without email OTP or a
 * social provider. In every other way it is an ordinary user — same hooks, same emails,
 * same notifications — so a run through onboarding can be verified from its mailbox. The
 * environment, not the identity, decides where those side effects land. The dapp's session
 * hook keys off the email to cap agent sessions at one hour, and `db:seed` (./seed.ts)
 * creates or resets this account.
 */
export const AGENT_ACCOUNT = { email: 'alex+agent@zivoe.com', name: 'Zivoe Agent' };
