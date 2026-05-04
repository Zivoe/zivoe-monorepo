import type { MetadataRoute } from 'next';

import { SITE_ORIGIN, absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/'
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_ORIGIN
  };
}
