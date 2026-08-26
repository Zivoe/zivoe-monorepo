/**
 * Compares every live catalog entry against the chain, the Centrifuge SDK and
 * the indexer — the questions the dApp used to ask in the browser on first
 * use, asked once here, for EVERY environment, before the values deploy.
 *
 *   pnpm centrifuge:verify            # both environments
 *   pnpm centrifuge:verify mainnet    # one environment
 *
 * Per live (share class × chain) it checks that:
 *   - the SDK resolves our Centrifuge vault from pool id + share-class id + USDC
 *   - the vault is sync-deposit / async-redeem, the shape the flows assume
 *   - the vault's share token, share decimals and asset decimals match ours
 *   - the protocol's VaultRouter (live, and the SDK's bundled mainnet allowlist) matches ours
 *   - the indexer prices the class, with our decimals
 *
 * Reads go over each chain's Alchemy endpoint when its key is in the
 * environment (NEXT_PUBLIC_{MAINNET,TESTNET}_ALCHEMY_KEY — the dApp's .env
 * is loaded when present), falling back to the chain's public RPCs. Nothing
 * is signed. Exits non-zero when any row mismatches or could not be read.
 */
import Centrifuge, { KNOWN_DEPLOYMENTS, PoolId, ShareClassId } from '@centrifuge/sdk';

// Default import on purpose: the package's sources are CommonJS under Node
// (no "type": "module"), and Node cannot see TypeScript's re-exports as named
// exports from an ES module — so the whole export object is taken instead.
import indexer, { type CentrifugeEnvironment } from '../src/index.js';

const {
  CENTRIFUGE_ENVIRONMENTS,
  CENTRIFUGE_ENVIRONMENT_FACTS,
  chainsOfEnvironment,
  fetchCurrentShareMetrics,
  getChainDeployment,
  getChainId,
  getChainRpcUrls,
  getShareClassChainIdentity,
  listLiveChains,
  listShareClassKeys
} = indexer;

// Two SDK warnings are muted as routine noise: chains the SDK has no RPC for
// (this script only queries the chains it configured), and dropped allowlist
// fields the dApp never transacts through — live runs show the indexer
// running ahead of the SDK's bundle on oracleValuation/wormholeAdapter as a
// matter of course. A dropped `vaultRouter` is NEVER muted: that contract is
// the approval spender this script verifies, so its warning prints and its
// row fails below.
const sdkWarn = console.warn;
console.warn = (...args: Array<unknown>) => {
  const line = String(args[0]);
  if (line.startsWith('No rpcUrl defined')) return;
  if (line.includes('Dropping unverified address') && !line.includes("field='vaultRouter'")) return;
  sdkWarn(...args);
};

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const describe = (error: unknown) => (error instanceof Error ? error.message.split('\n')[0] : String(error));

/** Prints one row as it is known; returns whether it matched. */
function check({
  subject,
  fact,
  expected,
  actual
}: {
  subject: string;
  fact: string;
  expected: string;
  actual: string;
}) {
  const ok = same(expected, actual);
  const label = `${subject} · ${fact}`.padEnd(44);
  console.log(ok ? `  ✓ ${label}  ${actual}` : `  ✗ ${label}  expected ${expected}, got ${actual}`);
  return ok;
}

function shapeOf({ isSyncDeposit, isSyncRedeem }: { isSyncDeposit: boolean; isSyncRedeem: boolean }): string {
  return `${isSyncDeposit ? 'sync' : 'async'}-deposit/${isSyncRedeem ? 'sync' : 'async'}-redeem`;
}

/** Returns the number of failed rows. */
async function verifyEnvironment(environment: CentrifugeEnvironment): Promise<number> {
  console.log(`\n${environment}`);

  const chains = chainsOfEnvironment(environment);
  const alchemyKey =
    environment === 'mainnet'
      ? process.env.NEXT_PUBLIC_MAINNET_ALCHEMY_KEY
      : process.env.NEXT_PUBLIC_TESTNET_ALCHEMY_KEY;
  const centrifuge = new Centrifuge({
    environment,
    indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
    rpcUrls: Object.fromEntries(chains.map((chain) => [getChainId(chain), getChainRpcUrls({ chain, alchemyKey })])),
    permitDisabled: true,
    disableRepeatOnEvents: true
  });

  let failed = 0;
  const fail = (subject: string, fact: string, error: unknown) => {
    failed += 1;
    console.log(`  ✗ ${`${subject} · ${fact}`.padEnd(44)}  could not read: ${describe(error)}`);
  };
  const verify = (row: Parameters<typeof check>[0]) => {
    if (!check(row)) failed += 1;
  };

  // Chain-level facts: one VaultRouter per chain, shared by every class on it.
  for (const chain of chains) {
    const { vaultRouter } = getChainDeployment(chain);

    let centrifugeId: number;
    try {
      centrifugeId = await centrifuge.id(getChainId(chain));
    } catch (error) {
      fail(chain, 'VaultRouter', error);
      continue;
    }

    try {
      // The SDK keeps no public accessor for its per-chain protocol addresses;
      // this is the same internal query its own writes resolve the router from.
      // The field is undefined when the SDK dropped it: the indexer's answer
      // disagreed with the bundled allowlist — a mismatch, not an RPC flake.
      const live = await (
        centrifuge as unknown as { _protocolAddresses(id: number): Promise<{ vaultRouter: string | undefined }> }
      )._protocolAddresses(centrifugeId);
      if (live.vaultRouter === undefined)
        fail(
          chain,
          'VaultRouter (live protocol)',
          new Error('the SDK dropped the indexer-reported router — it disagrees with the bundled allowlist')
        );
      else
        verify({ subject: chain, fact: 'VaultRouter (live protocol)', expected: vaultRouter, actual: live.vaultRouter });
    } catch (error) {
      fail(chain, 'VaultRouter (live protocol)', error);
    }

    // The SDK bundles a MAINNET-only allowlist it refuses to transact outside
    // of — keyed by centrifugeId, NOT by EVM chain id (they coincide only for
    // ethereum), and testnet chains reuse mainnet's centrifugeIds, so the
    // check only applies on mainnet: a testnet lookup would hit a mainnet
    // record. A mainnet chain the allowlist does not know is a failed row,
    // never a silent skip: the allowlist decides whether deposits can sign.
    if (environment === 'mainnet') {
      const bundled = KNOWN_DEPLOYMENTS[centrifugeId]?.vaultRouter;
      if (bundled)
        verify({ subject: chain, fact: 'VaultRouter (SDK allowlist)', expected: vaultRouter, actual: bundled });
      else
        fail(
          chain,
          'VaultRouter (SDK allowlist)',
          new Error(`no bundled record for centrifugeId ${String(centrifugeId)}`)
        );
    }
  }

  for (const key of listShareClassKeys(environment)) {
    try {
      const metrics = await fetchCurrentShareMetrics({ environment, shareClassKey: key });
      const { decimals } = getShareClassChainIdentity({ chain: listLiveChains({ environment, key })[0]!, key });
      verify({
        subject: key,
        fact: 'share decimals (indexer)',
        expected: String(decimals),
        actual: String(metrics.shareTokenDecimals)
      });
    } catch (error) {
      fail(key, 'indexed', error);
    }

    for (const chain of listLiveChains({ environment, key })) {
      const identity = getShareClassChainIdentity({ chain, key });
      const subject = `${key} on ${chain}`;
      const { usdc } = getChainDeployment(chain);

      try {
        const centrifugeId = await centrifuge.id(identity.chainId);
        const pool = await centrifuge.pool(new PoolId(identity.poolId));
        const vault = await pool.vault(centrifugeId, new ShareClassId(identity.scId), usdc.address);
        verify({ subject, fact: 'Centrifuge vault', expected: identity.centrifugeVaultAddress, actual: vault.address });

        const details = await vault.details();
        verify({ subject, fact: 'vault shape', expected: 'sync-deposit/async-redeem', actual: shapeOf(details) });
        verify({ subject, fact: 'share token', expected: identity.shareTokenAddress, actual: details.share.address });
        verify({
          subject,
          fact: 'share decimals (chain)',
          expected: String(identity.decimals),
          actual: String(details.share.decimals)
        });
        verify({ subject, fact: 'USDC', expected: usdc.address, actual: details.asset.address });
        verify({
          subject,
          fact: 'USDC decimals',
          expected: String(usdc.decimals),
          actual: String(details.asset.decimals)
        });
      } catch (error) {
        fail(subject, 'Centrifuge vault', error);
      }
    }
  }

  return failed;
}

async function main() {
  const requested = process.argv[2];
  const environments: ReadonlyArray<CentrifugeEnvironment> =
    requested === undefined
      ? CENTRIFUGE_ENVIRONMENTS
      : CENTRIFUGE_ENVIRONMENTS.filter((environment) => environment === requested);

  if (environments.length === 0) {
    console.error(`Unknown environment "${requested}". Expected one of: ${CENTRIFUGE_ENVIRONMENTS.join(', ')}.`);
    process.exit(2);
  }

  let failed = 0;
  for (const environment of environments) failed += await verifyEnvironment(environment);

  console.log(
    failed > 0
      ? `\n${String(failed)} row(s) mismatched or could not be read — fix the catalog (or retry on a flaky RPC) before deploying.`
      : '\nEvery live entry matches.'
  );
  // The SDK keeps RPC handles open; exit explicitly.
  process.exit(failed > 0 ? 1 : 0);
}

void main();
