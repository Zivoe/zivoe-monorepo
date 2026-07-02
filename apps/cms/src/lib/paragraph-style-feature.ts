import { createServerFeature } from '@payloadcms/richtext-lexical';

export const ParagraphStyleFeature = createServerFeature({
  feature: {
    ClientFeature: '@/lib/paragraph-style-feature.client#ParagraphStyleFeatureClient'
  },
  key: 'insightsParagraphStyle'
});
