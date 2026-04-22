import type { ReactNode } from 'react';

import {
  type ParsedLinkedInEmbed,
  type ParsedYouTubeEmbed,
  parseLinkedInEmbedUrl,
  parseYouTubeEmbedUrl
} from '@zivoe/cms-types/insights-embeds';
import { Link } from '@zivoe/ui/core/link';

import { TwitterEmbed } from './twitter-embed.client';

export function LinkedInPostEmbed({ caption, url }: { caption?: null | string; url: string }) {
  const parsed = parseLinkedInEmbedUrl(url);

  return (
    <EmbedFigure caption={caption}>
      {parsed ? <LinkedInEmbedFrame parsed={parsed} /> : <EmbedFallback href={url} provider="LinkedIn" />}
    </EmbedFigure>
  );
}

export function TwitterPostEmbed({ caption, url }: { caption?: null | string; url: string }) {
  return (
    <EmbedFigure caption={caption}>
      <TwitterEmbed url={url} />
    </EmbedFigure>
  );
}

export function YouTubeVideoEmbed({ caption, url }: { caption?: null | string; url: string }) {
  const parsed = parseYouTubeEmbedUrl(url);

  return (
    <EmbedFigure caption={caption}>
      {parsed ? <YouTubeEmbedFrame parsed={parsed} /> : <EmbedFallback href={url} provider="YouTube" />}
    </EmbedFigure>
  );
}

function EmbedFigure({ caption, children }: { caption?: null | string; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-3">
      {children}
      {caption?.trim() ? <figcaption className="text-small text-tertiary">{caption}</figcaption> : null}
    </figure>
  );
}

export function EmbedFallback({ href, provider }: { href: string; provider: string }) {
  return (
    <div className="rounded-[8px] border border-default bg-surface-base-soft p-4">
      <Link href={href} rel="noopener noreferrer" target="_blank" variant="link-primary" size="l">
        View on {provider}
      </Link>
    </div>
  );
}

function LinkedInEmbedFrame({ parsed }: { parsed: ParsedLinkedInEmbed }) {
  return (
    <div className="overflow-hidden rounded-[8px] bg-surface-base-soft">
      <iframe
        src={parsed.embedUrl}
        title="Embedded LinkedIn post"
        loading="lazy"
        allowFullScreen
        className="h-[34rem] w-full border-0 sm:h-[38rem]"
      />
    </div>
  );
}

function YouTubeEmbedFrame({ parsed }: { parsed: ParsedYouTubeEmbed }) {
  return (
    <div className="aspect-video overflow-hidden rounded-[8px] bg-surface-base-soft">
      <iframe
        src={`${parsed.embedUrl}?rel=0`}
        title="Embedded YouTube video"
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="size-full border-0"
      />
    </div>
  );
}
