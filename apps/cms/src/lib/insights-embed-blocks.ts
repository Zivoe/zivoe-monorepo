import type { Block, Field } from 'payload';

import { canonicalizeInsightsEmbedUrl, type InsightsEmbedBlockType } from '@zivoe/cms-types/insights-embeds';

const EMBED_CONFIG: Record<InsightsEmbedBlockType, { invalidUrlMessage: string; provider: string }> = {
  twitterEmbed: { invalidUrlMessage: 'Enter a valid public X/Twitter post URL.', provider: 'X' },
  linkedInEmbed: { invalidUrlMessage: 'Enter a valid public LinkedIn post URL.', provider: 'LinkedIn' },
  youtubeEmbed: { invalidUrlMessage: 'Enter a valid YouTube video URL.', provider: 'YouTube' }
};

const captionField: Field = {
  name: 'caption',
  type: 'text',
  admin: {
    description: 'Optional caption shown below the embed.'
  }
};

function createBlockImageDataUri(args: { accent: string; label: string; wide?: boolean }) {
  const width = args.wide ? 480 : 20;
  const height = args.wide ? 320 : 20;
  const fontSize = args.wide ? 112 : 11;
  const letterSpacing = args.wide ? 8 : 0.6;
  const radius = args.wide ? 24 : 5;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" rx="${radius}" fill="#0F172A" />
      <rect x="${args.wide ? 28 : 2}" y="${args.wide ? 28 : 2}" width="${width - (args.wide ? 56 : 4)}" height="${height - (args.wide ? 56 : 4)}" rx="${
        args.wide ? 18 : 4
      }" fill="${args.accent}" />
      <text
        x="50%"
        y="50%"
        fill="#FFFFFF"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        letter-spacing="${letterSpacing}"
        text-anchor="middle"
        dominant-baseline="middle"
      >${args.label}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createUrlField(blockType: InsightsEmbedBlockType): Field {
  return {
    name: 'url',
    type: 'text',
    required: true,
    admin: {
      description: `Paste the public ${EMBED_CONFIG[blockType].provider} URL.`
    },
    validate: (value: unknown) => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return 'URL is required.';
      }

      return canonicalizeInsightsEmbedUrl(blockType, value) ? true : EMBED_CONFIG[blockType].invalidUrlMessage;
    }
  };
}

function createEmbedBlock(args: {
  accent: string;
  interfaceName: string;
  singular: string;
  slug: InsightsEmbedBlockType;
  thumbnailLabel: string;
}) {
  const icon = createBlockImageDataUri({
    accent: args.accent,
    label: args.thumbnailLabel
  });

  const thumbnail = createBlockImageDataUri({
    accent: args.accent,
    label: args.thumbnailLabel,
    wide: true
  });

  return {
    slug: args.slug,
    interfaceName: args.interfaceName,
    labels: {
      singular: args.singular,
      plural: `${args.singular}s`
    },
    admin: {
      disableBlockName: true,
      group: 'Embeds',
      images: {
        icon,
        thumbnail
      }
    },
    fields: [createUrlField(args.slug), captionField]
  } satisfies Block;
}

export const insightsEmbedBlocks = [
  createEmbedBlock({
    accent: '#111827',
    interfaceName: 'InsightsTwitterEmbedBlock',
    singular: 'X Post',
    slug: 'twitterEmbed',
    thumbnailLabel: 'X'
  }),
  createEmbedBlock({
    accent: '#0A66C2',
    interfaceName: 'InsightsLinkedInEmbedBlock',
    singular: 'LinkedIn Post',
    slug: 'linkedInEmbed',
    thumbnailLabel: 'in'
  }),
  createEmbedBlock({
    accent: '#FF0033',
    interfaceName: 'InsightsYouTubeEmbedBlock',
    singular: 'YouTube Video',
    slug: 'youtubeEmbed',
    thumbnailLabel: 'YT'
  })
] satisfies Array<Block>;
