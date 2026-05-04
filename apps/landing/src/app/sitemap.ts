import type { MetadataRoute } from 'next';

import { getAllInsightSlugs } from '@/server/insights';

import { SITE_ORIGIN } from '@/lib/seo';

const STATIC_PATHS = ['/', '/team', '/faq', '/insights'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const insightEntries = await getAllInsightSlugs();

  return [
    ...STATIC_PATHS.map((path) => ({ url: `${SITE_ORIGIN}${path}` })),
    ...insightEntries.map((entry) => ({
      url: `${SITE_ORIGIN}/insights/${entry.slug}`,
      lastModified: entry.updatedAt ? new Date(entry.updatedAt) : undefined
    }))
  ];
}
