import { getHomeMetrics } from '@/server/home-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Reads are cached independently for 60 seconds. A CDN must not mask a stale status.
  return Response.json(await getHomeMetrics(), { headers: { 'Cache-Control': 'no-store' } });
}
