import type { MetadataRoute } from 'next';

import { getAllInsightSlugs } from '@/server/insights';

const SITE_ORIGIN = 'https://zivoe.com';

const STATIC_PATHS = ['/', '/about-us', '/team', '/faq', '/insights'];

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
