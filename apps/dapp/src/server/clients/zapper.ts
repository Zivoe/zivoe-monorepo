import * as Sentry from '@sentry/nextjs';
import ky from 'ky';

import { handlePromise } from '@/lib/utils';

import { env } from '@/env';

// Zapper's byAccount pagination limit - batch sizes must not exceed this
export const MAX_ACCOUNTS_PER_QUERY = 100;

const PORTFOLIO_QUERY = `
  query PortfolioV2($addresses: [Address!]!) {
    portfolioV2(addresses: $addresses) {
      tokenBalances {
        byAccount(first: 100) {
          edges {
            node {
              accountAddress
              balanceUSD
            }
          }
        }
      }
      appBalances {
        byAccount(first: 100) {
          edges {
            node {
              accountAddress
              balanceUSD
            }
          }
        }
      }
    }
  }
`;

interface ZapperPortfolio {
  tokenBalanceUSD: number;
  appBalanceUSD: number;
}

interface AccountBalanceNode {
  accountAddress: string;
  balanceUSD: number;
}

interface ByAccountConnection {
  edges: Array<{ node: AccountBalanceNode }>;
}

interface PortfolioResponse {
  data: {
    portfolioV2: {
      tokenBalances: { byAccount: ByAccountConnection };
      appBalances: { byAccount: ByAccountConnection };
    };
  };
  errors?: Array<{ message: string }>;
}

const zapperClient = ky.create({
  prefixUrl: 'https://public.zapper.xyz',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(env.ZAPPER_API_KEY + ':').toString('base64')}`
  },
  retry: {
    limit: 1,
    methods: ['post'],
    statusCodes: [408, 429, 500, 502, 503, 504]
  }
});

export async function fetchPortfolios(addresses: string[]): Promise<Map<string, ZapperPortfolio>> {
  if (addresses.length === 0) {
    return new Map();
  }

  const { res: json, err } = await handlePromise(
    zapperClient
      .post('graphql', {
        json: {
          query: PORTFOLIO_QUERY,
          variables: { addresses: addresses.map((a) => a.toLowerCase()) }
        }
      })
      .json<PortfolioResponse>()
  );

  if (err || !json) throw err;

  if (json.errors && json.errors.length > 0) {
    throw new Error(`Zapper GraphQL error: ${json.errors[0]?.message ?? 'Unknown error'}`);
  }

  const result = new Map<string, ZapperPortfolio>();
  const portfolioData = json.data?.portfolioV2;

  if (!portfolioData) {
    Sentry.captureException(new Error('Zapper portfolioV2 returned null'), {
      tags: { source: 'SERVER', flow: 'zapper-portfolio-v2-null' },
      extra: { addressCount: addresses.length }
    });

    return result;
  }

  // Build a map of address -> balances from byAccount edges
  const tokenBalancesByAddress = new Map<string, number>();
  const appBalancesByAddress = new Map<string, number>();

  for (const edge of portfolioData.tokenBalances?.byAccount?.edges ?? []) {
    const addr = edge.node.accountAddress.toLowerCase();
    tokenBalancesByAddress.set(addr, (tokenBalancesByAddress.get(addr) ?? 0) + edge.node.balanceUSD);
  }

  for (const edge of portfolioData.appBalances?.byAccount?.edges ?? []) {
    const addr = edge.node.accountAddress.toLowerCase();
    appBalancesByAddress.set(addr, (appBalancesByAddress.get(addr) ?? 0) + edge.node.balanceUSD);
  }

  // Build result map — addresses not in response default to $0
  for (const address of addresses) {
    const normalizedAddress = address.toLowerCase();
    const portfolio: ZapperPortfolio = {
      tokenBalanceUSD: tokenBalancesByAddress.get(normalizedAddress) ?? 0,
      appBalanceUSD: appBalancesByAddress.get(normalizedAddress) ?? 0
    };
    result.set(normalizedAddress, portfolio);
  }

  return result;
}
