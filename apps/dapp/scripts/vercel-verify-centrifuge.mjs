/**
 * Deploy gate over the Share Class Catalog: Vercel builds (production AND
 * preview) run `pnpm centrifuge:verify` before `next build`, so a catalog
 * value the chain, the SDK or the indexer contradicts can never ship. Local
 * builds skip — the check needs live RPCs and belongs at the moment values
 * deploy, not in every dev loop (CI runs the offline suites instead).
 *
 * Only the deployment's own environment is verified (NEXT_PUBLIC_CHAIN_ENV,
 * the same variable the dApp derives ACTIVE_ENVIRONMENT from), so a preview
 * never fails on mainnet drift it does not serve. The reads use the
 * deployment's NEXT_PUBLIC_*_ALCHEMY_KEY when set, falling back to public
 * RPCs.
 *
 * SKIP_CENTRIFUGE_VERIFY=1 is the loud escape hatch: it lets an urgent,
 * catalog-unrelated deploy build through a Centrifuge RPC/indexer outage —
 * unset it again afterwards.
 */
import { spawnSync } from 'node:child_process';

// Not a Vercel build — local `next build`, CI, etc. Nothing is deploying.
if (!process.env.VERCEL_ENV) process.exit(0);

if (process.env.SKIP_CENTRIFUGE_VERIFY) {
  console.warn('SKIP_CENTRIFUGE_VERIFY is set — building WITHOUT verifying the Share Class Catalog.');
  process.exit(0);
}

const environment = process.env.NEXT_PUBLIC_CHAIN_ENV;
const args = ['--filter', '@zivoe/centrifuge-indexer', 'verify', ...(environment ? [environment] : [])];

console.log(`Verifying the Share Class Catalog (${environment ?? 'all environments'}) before the build…`);
const { status } = spawnSync('pnpm', args, { stdio: 'inherit' });
process.exit(status ?? 1);
