const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const LINKEDIN_URN_TYPES = ['activity', 'share', 'ugcPost'] as const;
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export const INSIGHTS_EMBED_BLOCK_TYPES = ['twitterEmbed', 'linkedInEmbed', 'youtubeEmbed'] as const;

export type InsightsEmbedBlockType = (typeof INSIGHTS_EMBED_BLOCK_TYPES)[number];
export type LinkedInUrnType = (typeof LINKEDIN_URN_TYPES)[number];

export type InsightsTwitterEmbedBlockFields = {
  blockType: 'twitterEmbed';
  caption?: null | string;
  url: string;
};

export type InsightsLinkedInEmbedBlockFields = {
  blockType: 'linkedInEmbed';
  caption?: null | string;
  url: string;
};

export type InsightsYouTubeEmbedBlockFields = {
  blockType: 'youtubeEmbed';
  caption?: null | string;
  url: string;
};

export type InsightsEmbedBlockFields =
  | InsightsTwitterEmbedBlockFields
  | InsightsLinkedInEmbedBlockFields
  | InsightsYouTubeEmbedBlockFields;

export type ParsedTwitterEmbed = {
  canonicalUrl: string;
  tweetId: string;
};

export type ParsedLinkedInEmbed = {
  canonicalUrl: string;
  embedUrl: string;
  urn: string;
  urnType: LinkedInUrnType;
};

export type ParsedYouTubeEmbed = {
  canonicalUrl: string;
  embedUrl: string;
  videoId: string;
};

export function isInsightsEmbedBlockType(value: string): value is InsightsEmbedBlockType {
  return INSIGHTS_EMBED_BLOCK_TYPES.includes(value as InsightsEmbedBlockType);
}

export function canonicalizeInsightsEmbedUrl(blockType: InsightsEmbedBlockType, value: string): null | string {
  switch (blockType) {
    case 'twitterEmbed':
      return parseTwitterEmbedUrl(value)?.canonicalUrl ?? null;
    case 'linkedInEmbed':
      return parseLinkedInEmbedUrl(value)?.canonicalUrl ?? null;
    case 'youtubeEmbed':
      return parseYouTubeEmbedUrl(value)?.canonicalUrl ?? null;
  }
}

export function parseTwitterEmbedUrl(input: string): null | ParsedTwitterEmbed {
  const url = parseHttpUrl(input);
  if (!url || !isTwitterHostname(url.hostname)) return null;

  const statusMatch = url.pathname.match(/(?:^|\/)status(?:es)?\/(\d+)(?:\/|$)/);
  const tweetId = statusMatch?.[1];

  if (!tweetId) return null;

  const authorStatusMatch = url.pathname.match(/^\/([^/]+)\/status\/(\d+)(?:\/)?$/);
  const canonicalPath = authorStatusMatch ? `/${authorStatusMatch[1]}/status/${tweetId}` : `/i/web/status/${tweetId}`;

  return {
    canonicalUrl: `https://x.com${canonicalPath}`,
    tweetId
  };
}

export function parseLinkedInEmbedUrl(input: string): null | ParsedLinkedInEmbed {
  const url = parseHttpUrl(input);
  if (!url || !isLinkedInHostname(url.hostname)) return null;

  const pathname = cleanPathname(url.pathname);
  const urnMatch = pathname.match(/^\/(?:embed\/)?feed\/update\/(urn:li:(activity|share|ugcPost):(\d+))$/i);

  if (urnMatch) {
    const urnType = urnMatch[2] as LinkedInUrnType;
    const urn = `urn:li:${urnType}:${urnMatch[3]}`;

    return {
      canonicalUrl: `https://www.linkedin.com/feed/update/${urn}`,
      embedUrl: `https://www.linkedin.com/embed/feed/update/${urn}`,
      urn,
      urnType
    };
  }

  const activityMatch = pathname.match(/(?:^|-)activity-(\d+)(?:-|$)/);
  if (!activityMatch) return null;

  const urn = `urn:li:activity:${activityMatch[1]}`;
  return {
    canonicalUrl: `https://www.linkedin.com/feed/update/${urn}`,
    embedUrl: `https://www.linkedin.com/embed/feed/update/${urn}`,
    urn,
    urnType: 'activity'
  };
}

export function parseYouTubeEmbedUrl(input: string): null | ParsedYouTubeEmbed {
  const url = parseHttpUrl(input);
  if (!url || !isYouTubeHostname(url.hostname)) return null;

  const hostname = normalizeHostname(url.hostname);
  const pathname = cleanPathname(url.pathname);
  let videoId: null | string = null;

  if (hostname === 'youtu.be') {
    videoId = pathname.slice(1).split('/')[0] || null;
  } else if (pathname === '/watch') {
    videoId = url.searchParams.get('v');
  } else {
    const pathMatch = pathname.match(/^\/(?:embed|live|shorts)\/([^/]+)$/);
    videoId = pathMatch?.[1] ?? null;
  }

  if (!videoId || !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) return null;

  return {
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    videoId
  };
}

function cleanPathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

function isLinkedInHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === 'linkedin.com' || normalized.endsWith('.linkedin.com');
}

function isTwitterHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === 'twitter.com' || normalized === 'x.com';
}

function isYouTubeHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === 'youtube.com' ||
    normalized.endsWith('.youtube.com') ||
    normalized === 'youtube-nocookie.com' ||
    normalized.endsWith('.youtube-nocookie.com') ||
    normalized === 'youtu.be'
  );
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^(?:www|m)\./, '');
}

function parseHttpUrl(value: string): null | URL {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return HTTP_PROTOCOLS.has(url.protocol) ? url : null;
  } catch {
    return null;
  }
}
