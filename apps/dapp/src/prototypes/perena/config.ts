export const PERENA_DEMO_PATH = '/vaults/perena-usdc-demo';
export const PERENA_DEMO_NOTICE = 'Interactive demo. Balances and transactions are simulated.';

type DemoConfig = {
  name: string;
  decimals: number;
  initialUsdc: bigint;
  sharePrice: bigint;
  fee: bigint;
  sampleApy: number;
  sampleNav: number;
  processingMs: number;
  storageKey: string;
  docsUrl: string;
};

export const PERENA_DEMO = {
  name: 'Zivoe Alternative Credit',
  decimals: 6,
  initialUsdc: 1_000_000_000n,
  sharePrice: 1_000_000n,
  fee: 0n,
  sampleApy: 6,
  sampleNav: 250_000,
  processingMs: 1_400,
  storageKey: 'zivoe:prototype:perena-usdc:v1',
  docsUrl: 'https://perena.gitbook.io/perena/protocol/perena-vault-v2'
} as const satisfies DemoConfig;
