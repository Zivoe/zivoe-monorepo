import { type Address } from 'viem';

import {
  CENTRIFUGE_CHAINS,
  CENTRIFUGE_CHAIN_DEPLOYMENTS,
  CENTRIFUGE_ENVIRONMENTS,
  type CentrifugeChain,
  type CentrifugeChainOf,
  type CentrifugeEnvironment,
  chainsOfEnvironment,
  getChainId,
  isPlausibleAddress
} from './chains';

/**
 * The stablecoin a Centrifuge vault accepts — one per vault, so one per live
 * (share class, chain) entry. Symbol and scale are authored beside the
 * address because both are on-chain facts of THAT token, not of the symbol:
 * Circle-native USDC is 6 decimals, BNB Smart Chain's Binance-Peg USDC is
 * 18, and a second stablecoin (DAI, FRAX) is a new entry, not new code. The
 * lint bounds the scale to the protocol's ceiling and `pnpm centrifuge:verify`
 * checks all three against what the vault reports.
 */
export type DepositAsset = { address: Address; symbol: string; decimals: number };

/**
 * Centrifuge's asset ceiling: Spoke and HubRegistry refuse to register an
 * asset above it because PricingLib's conversions assume decimals <= 18.
 * A catalog value past it cannot be a vault's asset, whatever the token says.
 */
const MAX_ASSET_DECIMALS = 18;

/**
 * One share class's instance on one spoke chain it claims. A launch is
 * `staged` while the values are not operator-verified yet — there is nothing
 * to read off a staged entry, by construction, so no reader has to guard
 * against placeholders. Once live, both addresses and the asset are real.
 */
export type ShareClassChainDeployment =
  | { status: 'staged' }
  | {
      status: 'live';
      shareTokenAddress: Address;
      /** The Centrifuge vault instantiating the share class for `asset` on this chain. */
      centrifugeVaultAddress: Address;
      /**
       * The deposit asset that Centrifuge vault accepts. One per entry on
       * purpose: every chain-scoped query key and vault memo identifies the
       * vault by chain alone, which holds only while there is one vault per
       * chain. A class accepting a second asset on one chain becomes a list
       * here AND an asset dimension on those keys — not a second entry.
       */
      asset: DepositAsset;
    };

/**
 * One share class's presence in one environment. Pool id and share-class id
 * are hub-level facts — identical on every spoke chain of the environment —
 * which is why they live here and not per chain. The chains record can only
 * name chains of this environment; filing one under the wrong hub is a
 * compile error.
 */
export type ShareClassEnvironmentDeployment<E extends CentrifugeEnvironment = CentrifugeEnvironment> = {
  /** The pool id — the indexer's pool entity id and per-pool filter key. */
  poolId: string;
  /** The share-class id — the indexer's token / token-snapshot entity id. Stored lowercase: query sites send it verbatim. */
  scId: `0x${string}`;
  /** Spoke chains the share class is staged or live on — absent means not available there. */
  chains: Partial<Record<CentrifugeChainOf<E>, ShareClassChainDeployment>>;
};

export type ShareClassEntry = {
  symbol: string;
  decimals: number;
  /** Environments the share class is on — absent means not available there. */
  environments: { [E in CentrifugeEnvironment]?: ShareClassEnvironmentDeployment<E> };
};

/**
 * Every Centrifuge share class Zivoe integrates, as pure serializable data —
 * the single source both apps derive share-class identity from. Adding a
 * class means adding an entry here plus a Zivoe Vault module in the dApp (the
 * compiler demands the module). Reviews of new entries must verify the
 * values on-chain and that the pool is USD-denominated; `pnpm
 * centrifuge:verify` compares every live entry against the chain and the
 * indexer. Flip a chain to `live` only once the Centrifuge vault is deployed
 * AND the indexer prices the class on that chain: the aggregated NAV read is
 * fail-closed, so a live-but-unpriced entry hides the whole-book number on
 * every surface until it is indexed.
 */
export const SHARE_CLASSES = {
  zsmb: {
    symbol: 'zSMB',
    decimals: 18,
    environments: {
      testnet: {
        poolId: '281474976720680',
        scId: '0x00010000000027280000000000000002',
        chains: {
          sepolia: {
            status: 'live',
            shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6',
            centrifugeVaultAddress: '0x7Bfa3382eC44e2279BBf0c555B87702fbbFf3AD6',
            asset: { address: '0x3aaaa86458d576BafCB1B7eD290434F0696dA65c', symbol: 'USDC', decimals: 6 }
          },
          'base-sepolia': {
            status: 'live',
            shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6',
            centrifugeVaultAddress: '0x8aBb393C433375401EEeae24557475C3f36f5025',
            asset: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', symbol: 'USDC', decimals: 6 }
          }
        }
      },

      mainnet: {
        poolId: '281474976710674',
        scId: '0x00010000000000120000000000000002',
        chains: {
          ethereum: {
            status: 'live',
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            centrifugeVaultAddress: '0xD3A4fe3E0d0b89fFaf43D296727540C23de6d639',
            asset: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }
          },
          pharos: {
            status: 'live',
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            centrifugeVaultAddress: '0x63D2b3596510b95CF02D921f21BaC19d31c9A4c6',
            asset: { address: '0xC879C018dB60520F4355C26eD1a6D572cdAC1815', symbol: 'USDC', decimals: 6 }
          },
          base: {
            status: 'live',
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            centrifugeVaultAddress: '0x47902c2D7F2Ee443B5DCb2DA7cFA619b194B79d3',
            asset: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 }
          },
          arbitrum: {
            status: 'live',
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            centrifugeVaultAddress: '0x2Aed63Ebf806B9C767e94F6F305ff628B59D454E',
            asset: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6 }
          },
          avalanche: {
            status: 'live',
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            centrifugeVaultAddress: '0x3CAf4235Eb6d322aB38B0C3a49abD786D1eB4b31',
            asset: { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', decimals: 6 }
          },
          optimism: {
            status: 'live',
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            centrifugeVaultAddress: '0x991de0203E455dfC4B8f38F7c333487c16aDdE55',
            asset: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', decimals: 6 }
          },
          hyperliquid: {
            status: 'live',
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            centrifugeVaultAddress: '0x8839273d6e0901Bbb5F674F8C4CDC6f5C1915042',
            asset: { address: '0xb88339CB7199b77E23DB6E890353E22632Ba630f', symbol: 'USDC', decimals: 6 }
          },
          xlayer: {
            status: 'live',
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            centrifugeVaultAddress: '0xde9A47aB87ED1a08B727009AF570381f7B7F6edF',
            asset: { address: '0xB6CEceAB302E2E4948951eE7843FC24E92933061', symbol: 'USDC', decimals: 6 }
          },
          bnb: {
            status: 'live',
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            centrifugeVaultAddress: '0x616997144B1Ae546359596311853A7Da297CbAe2',
            // Binance-Peg USD Coin, the only 18-decimal deposit asset in the
            // book — BNB Smart Chain has no Circle-native USDC.
            asset: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18 }
          },
          monad: {
            status: 'live',
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            centrifugeVaultAddress: '0xF6AB108f90e7fbdf34940685C0Be07acfff091CE',
            asset: { address: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', symbol: 'USDC', decimals: 6 }
          }
        }
      }
    }
  }
} as const satisfies Record<string, ShareClassEntry>;

export type ShareClassKey = keyof typeof SHARE_CLASSES;

/** Union of every catalogued share token symbol — derive token unions from this, never hand-extend them. */
export type ShareClassSymbol = (typeof SHARE_CLASSES)[ShareClassKey]['symbol'];

// Distributive on purpose: `keyof` over a union of records keeps only their
// COMMON keys, and the testnet and mainnet chain records share none.
type ValuesOf<T> = T extends unknown ? T[keyof T] : never;
type LiveAssetSymbolOf<T> = T extends { status: 'live'; asset: { symbol: infer S } } ? S : never;

/**
 * Union of every deposit asset symbol a live catalog entry carries, on any
 * environment — the deposit-side twin of ShareClassSymbol. Display maps key
 * on it so a new stablecoin in the catalog demands its display entry at
 * compile time.
 */
export type DepositAssetSymbol = LiveAssetSymbolOf<
  ValuesOf<ValuesOf<(typeof SHARE_CLASSES)[ShareClassKey]['environments']>['chains']>
>;

/**
 * A share class's hub-level identity resolved for one environment —
 * serializable, live somewhere. Everything here is identical across the
 * environment's spoke chains; chain-scoped facts live on
 * ShareClassChainIdentity.
 */
export type ShareClassIdentity = {
  key: ShareClassKey;
  symbol: ShareClassSymbol;
  decimals: number;
  poolId: string;
  scId: `0x${string}`;
};

/** The hub identity joined with the share class's live instance on one spoke chain. */
export type ShareClassChainIdentity = ShareClassIdentity & {
  chain: CentrifugeChain;
  chainId: number;
  shareTokenAddress: Address;
  centrifugeVaultAddress: Address;
  asset: DepositAsset;
};

/**
 * Structural view of the catalog for the listing helpers and the lint —
 * tests inject synthetic catalogs, so addresses are plain strings here.
 */
type ShareClassesLike = Record<
  string,
  {
    symbol: string;
    decimals: number;
    environments: Partial<
      Record<
        CentrifugeEnvironment,
        {
          poolId: string;
          scId: string;
          chains: Partial<
            Record<
              CentrifugeChain,
              | { status: 'staged' }
              | {
                  status: 'live';
                  shareTokenAddress: string;
                  centrifugeVaultAddress: string;
                  asset: { address: string; symbol: string; decimals: number };
                }
            >
          >;
        }
      >
    >;
  }
>;

/** The real catalog viewed with an open chain index — the as-const entries narrow their chain keys, which a CentrifugeChain cannot address. */
type ChainLookup = Record<
  string,
  {
    environments: Partial<
      Record<CentrifugeEnvironment, { chains: Partial<Record<CentrifugeChain, ShareClassChainDeployment>> }>
    >;
  }
>;

// A checked assignment, not a cast — the compiler proves the widened view is
// sound, so a catalog shape change cannot silently invalidate the lookup.
const SHARE_CLASS_CHAIN_LOOKUP: ChainLookup = SHARE_CLASSES;

function isShareClassKey(key: string): key is ShareClassKey {
  // Object.hasOwn, not `in`: ids arrive as arbitrary strings, and a
  // prototype-chain key like "toString" must fail the guard, not pass it and
  // die dereferencing a function's `environments`.
  return Object.hasOwn(SHARE_CLASSES, key);
}

/**
 * The environment's chains the share class is live on, in canonical order.
 * Empty for a class the catalog does not know — this is a listing, not a
 * lookup, so it never throws; the identity resolvers are the trust boundary.
 */
export function listLiveChains(
  { environment, key }: { environment: CentrifugeEnvironment; key: string },
  catalog: ShareClassesLike = SHARE_CLASSES
): Array<CentrifugeChain> {
  const chains = Object.hasOwn(catalog, key) ? catalog[key]?.environments[environment]?.chains : undefined;
  if (!chains) return [];

  return chainsOfEnvironment(environment).filter((chain) => chains[chain]?.status === 'live');
}

/**
 * Resolves a share-class id to its hub-level identity on one environment.
 * Accepts the open string domain — ids travel through caches and providers as
 * plain strings — and fails loudly for ids the catalog does not know or that
 * are not live on at least one chain of the environment.
 */
export function getShareClassIdentity({
  environment,
  key
}: {
  environment: CentrifugeEnvironment;
  key: string;
}): ShareClassIdentity {
  if (!isShareClassKey(key)) throw new Error(`Share class "${key}" is not in the catalog.`);

  const entry = SHARE_CLASSES[key];
  const onEnvironment = entry.environments[environment];

  if (!onEnvironment) throw new Error(`Share class "${key}" is not available on "${environment}".`);

  if (listLiveChains({ environment, key }).length === 0)
    throw new Error(`Share class "${key}" is not live on any "${environment}" chain.`);

  return {
    key,
    symbol: entry.symbol,
    decimals: entry.decimals,
    poolId: onEnvironment.poolId,
    scId: onEnvironment.scId
  };
}

/**
 * Resolves a share-class id to its live identity on one spoke chain (the
 * chain implies the environment). Fails loudly for ids the catalog does not
 * know, chains the class is not available on, and staged launches.
 */
export function getShareClassChainIdentity({
  chain,
  key
}: {
  chain: CentrifugeChain;
  key: string;
}): ShareClassChainIdentity {
  const { environment } = CENTRIFUGE_CHAIN_DEPLOYMENTS[chain];

  // The hub half delegates — one trust boundary and one assembly, so a hub
  // field added to ShareClassIdentity cannot be forgotten here.
  const identity = getShareClassIdentity({ environment, key });

  // Viewed structurally at the lookup only — the delegate above already
  // resolved the narrow entry, so `symbol` keeps its union type.
  const onChain = SHARE_CLASS_CHAIN_LOOKUP[identity.key]?.environments[environment]?.chains[chain];

  if (!onChain) throw new Error(`Share class "${key}" is not available on "${chain}".`);

  if (onChain.status !== 'live')
    throw new Error(`Share class "${key}" on "${chain}" is staged. Fill in operator-verified values before deploying.`);

  return {
    ...identity,
    chain,
    chainId: getChainId(chain),
    shareTokenAddress: onChain.shareTokenAddress,
    centrifugeVaultAddress: onChain.centrifugeVaultAddress,
    asset: onChain.asset
  };
}

/**
 * The distinct deposit assets the share class accepts across the
 * environment's live chains, in canonical chain order and deduped by symbol
 * — the derivation behind every "accepted stablecoins" surface. Deduped by
 * symbol on purpose: USDC at 6 decimals and Binance-Peg USDC at 18 are one
 * stablecoin to an investor, and the per-chain instance (address, scale)
 * is the transaction identity's business, not a listing's. Empty for a
 * class the catalog does not know, like listLiveChains.
 */
export function listDepositAssets(
  { environment, key }: { environment: CentrifugeEnvironment; key: string },
  catalog: ShareClassesLike = SHARE_CLASSES
): Array<DepositAsset> {
  const chains = Object.hasOwn(catalog, key) ? catalog[key]?.environments[environment]?.chains : undefined;
  if (!chains) return [];

  const bySymbol = new Map<string, DepositAsset>();
  for (const chain of listLiveChains({ environment, key }, catalog)) {
    const onChain = chains[chain];
    // The structural view types addresses as plain strings (tests inject
    // synthetic catalogs); the real catalog's are checked Address literals.
    if (onChain?.status === 'live' && !bySymbol.has(onChain.asset.symbol))
      bySymbol.set(onChain.asset.symbol, onChain.asset as DepositAsset);
  }
  return [...bySymbol.values()];
}

/**
 * Keys of the share classes live (on at least one chain) in the environment,
 * in catalog order. No caller needs the key union back — consumers count,
 * re-resolve through the identity helpers, or pass the keys straight to
 * queries.
 */
export function listShareClassKeys(
  environment: CentrifugeEnvironment,
  catalog: ShareClassesLike = SHARE_CLASSES
): Array<string> {
  return Object.keys(catalog).filter((key) => listLiveChains({ environment, key }, catalog).length > 0);
}

/** Throws via `message` on the first duplicate — shared by the catalog and registry lint tests. */
export function assertUnique({ values, message }: { values: Array<string>; message: (duplicate: string) => string }) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) throw new Error(message(value));
    seen.add(value);
  }
}

/**
 * Data lint over the catalog. It runs once at module load (below) — both
 * apps' builds import this module, so a bad catalog fails the deploy, not
 * whichever test run someone remembers to make — and the test suite
 * exercises each rule against synthetic catalogs. Two entries sharing an
 * on-chain identity would serve one share class's data under the other's
 * name (and the aggregated NAV read would double-count the class); two
 * sharing a symbol would collide in every token display map. Swept across
 * EVERY environment and chain, staged or live — cutover is the expensive
 * time to find a duplicate.
 */
export function assertShareClassInvariants(catalog: ShareClassesLike = SHARE_CLASSES): void {
  const entries = Object.values(catalog);

  // Lowercased: two symbols differing only in case would read as one share class
  // to a user while keying two display-map entries.
  assertUnique({
    values: entries.map((entry) => entry.symbol.toLowerCase()),
    message: (symbol) => `Share token symbol "${symbol}" is claimed by two share classes.`
  });

  for (const [key, entry] of Object.entries(catalog)) {
    // Decimals scale every parseUnits and NAV division. 36 is comfortably
    // past any real ERC-20; beyond it is a typo, not a token.
    if (!Number.isInteger(entry.decimals) || entry.decimals < 0 || entry.decimals > 36)
      throw new Error(`Share class "${key}" declares implausible decimals: ${String(entry.decimals)}.`);

    for (const [environment, onEnvironment] of Object.entries(entry.environments)) {
      // The pool id is PoolId's input and the indexer's per-pool filter key —
      // a placeholder or typo here would otherwise fail only at runtime.
      if (!/^[1-9]\d*$/.test(onEnvironment.poolId))
        throw new Error(
          `Share class "${key}" declares an implausible pool id on "${environment}": "${onEnvironment.poolId}".`
        );

      // Query sites send the scId verbatim (the indexer matches ids exactly),
      // unlike addresses, which they lowercase — so it must be stored lowercase.
      if (onEnvironment.scId !== onEnvironment.scId.toLowerCase())
        throw new Error(`Share class "${key}" must store its scId lowercase on "${environment}".`);

      // 16 bytes, and never the zero placeholder a staged copy-paste leaves behind.
      if (!/^0x[0-9a-f]{32}$/.test(onEnvironment.scId) || /^0x0+$/.test(onEnvironment.scId))
        throw new Error(
          `Share class "${key}" declares an implausible scId on "${environment}": "${onEnvironment.scId}".`
        );

      // `Address` only types the 0x prefix — a truncated paste or zero
      // placeholder on a LIVE entry must fail the build, not a transaction.
      for (const [chain, onChain] of Object.entries(onEnvironment.chains)) {
        if (onChain.status !== 'live') continue;
        for (const [field, address] of [
          ['share token', onChain.shareTokenAddress],
          ['Centrifuge vault', onChain.centrifugeVaultAddress],
          ['deposit asset', onChain.asset.address]
        ] as const) {
          if (!isPlausibleAddress(address))
            throw new Error(
              `Share class "${key}" declares an implausible ${field} address on "${chain}": "${address}".`
            );
        }

        // The asset's scale sizes every parseUnits, approval and Balance the
        // deposit flow builds; past the protocol ceiling it cannot be a
        // vault's asset at all. The symbol is the display-map key.
        const { symbol, decimals } = onChain.asset;
        if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_ASSET_DECIMALS)
          throw new Error(
            `Share class "${key}" declares implausible deposit asset decimals on "${chain}": ${String(decimals)}.`
          );
        if (symbol.trim() === '')
          throw new Error(`Share class "${key}" declares a deposit asset with no symbol on "${chain}".`);
      }
    }
  }

  // The share-token display map spreads over the deposit-asset map, so a
  // share class claiming a deposit asset's symbol would silently take over
  // that asset's display entry. Lowercased like the symbol uniqueness above.
  const depositAssetSymbols = new Set(
    entries.flatMap((entry) =>
      Object.values(entry.environments).flatMap((onEnvironment) =>
        Object.values(onEnvironment.chains).flatMap((onChain) =>
          onChain.status === 'live' ? [onChain.asset.symbol.toLowerCase()] : []
        )
      )
    )
  );
  for (const [key, entry] of Object.entries(catalog)) {
    if (depositAssetSymbols.has(entry.symbol.toLowerCase()))
      throw new Error(`Share class "${key}" claims the deposit asset symbol "${entry.symbol}".`);
  }

  for (const environment of CENTRIFUGE_ENVIRONMENTS) {
    // scIds are hub-level, so uniqueness is per environment...
    assertUnique({
      values: entries.flatMap((entry) => {
        const scId = entry.environments[environment]?.scId.toLowerCase();
        return scId ? [scId] : [];
      }),
      message: (scId) => `Share-class id ${scId} is claimed by two catalog entries on "${environment}".`
    });
  }

  // ...while token and Centrifuge-vault instances are per-chain, so address
  // uniqueness is per chain (the same address on two chains is legitimate
  // under deterministic deployment, and must not false-positive here).
  for (const chain of CENTRIFUGE_CHAINS) {
    const environment = CENTRIFUGE_CHAIN_DEPLOYMENTS[chain].environment;
    const live = entries.flatMap((entry) => {
      const onChain = entry.environments[environment]?.chains[chain];
      return onChain?.status === 'live' ? [onChain] : [];
    });

    assertUnique({
      values: live.map((onChain) => onChain.shareTokenAddress.toLowerCase()),
      message: (address) => `Share token ${address} is claimed by two share classes on "${chain}".`
    });
    assertUnique({
      values: live.map((onChain) => onChain.centrifugeVaultAddress.toLowerCase()),
      message: (address) => `Centrifuge vault ${address} is claimed by two share classes on "${chain}".`
    });
  }
}

// Import-time on purpose: a pure sweep over a handful of entries, and the one
// enforcement point every build path is guaranteed to hit.
assertShareClassInvariants();
