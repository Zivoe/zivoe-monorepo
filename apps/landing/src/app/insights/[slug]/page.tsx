import { type ReactNode } from 'react';

import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { ArrowLeftIcon } from '@zivoe/ui/icons';
import { NextLink } from '@zivoe/ui/core/link';

import Container from '@/components/container';
import Footer from '@/components/footer';
import Newsletter from '@/components/newsletter';
import { getAllInsightSlugs, getInsightPostBySlug, getRelatedInsightPosts } from '@/server/insights';
import { getInsightsPreviewSession } from '@/server/insights/preview';
import { formatInsightDate } from '@/server/insights';
import { getInsightsCmsOrigin } from '@/server/clients/cms';

import { InsightCard } from '../_components/card';
import { LeavePreviewBanner } from '../_components/leave-preview';
import { InsightsLivePreview } from '../_components/live-preview';
import { InsightsRichText } from '../_components/rich-text';

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const entries = await getAllInsightSlugs();
  return entries
    .filter((entry) => typeof entry.slug === 'string' && entry.slug.length > 0)
    .map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const previewSession = await getInsightsPreviewSession();
  const post = await getInsightPostBySlug({
    preview: previewSession.isEnabled,
    slug
  });

  if (!post) {
    return {
      title: 'Insight Not Found | Zivoe'
    };
  }

  const image = post.seoImageOverride?.heroUrl ?? post.seoImageOverride?.url ?? post.featuredImage.heroUrl ?? post.featuredImage.url;
  const title = `${post.metaTitle} | Zivoe`;
  const description = post.metaDescription;
  const url = `https://zivoe.com/insights/${post.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url,
      images: image ? [{ url: image, alt: post.featuredImage.alt }] : undefined,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt ?? undefined,
      authors: post.author.name ? [post.author.name] : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined
    }
  };
}

export default async function InsightPostPage({ params }: PageProps) {
  const { slug } = await params;
  const previewSession = await getInsightsPreviewSession();
  const post = await getInsightPostBySlug({
    preview: previewSession.isEnabled,
    slug
  });

  if (!post) notFound();

  const relatedPosts = await getRelatedInsightPosts({
    categoryId: post.category.id,
    currentPostId: post.id,
    preview: previewSession.isEnabled
  });

  const articleImage =
    post.seoImageOverride?.heroUrl ?? post.seoImageOverride?.url ?? post.featuredImage.heroUrl ?? post.featuredImage.url;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription,
    image: articleImage ? [articleImage] : undefined,
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt ?? undefined,
    author: { '@type': 'Person', name: post.author.name },
    publisher: {
      '@type': 'Organization',
      name: 'Zivoe',
      logo: { '@type': 'ImageObject', url: 'https://zivoe.com/favicon.ico' }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://zivoe.com/insights/${post.slug}`
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Container className="px-4 pb-20 pt-10 sm:px-10 xl:px-[8.5rem]">
        <div className="mx-auto flex w-full max-w-[57rem] flex-col gap-8">
          {previewSession.isEnabled ? <InsightsLivePreview serverURL={getInsightsCmsOrigin()} /> : null}

          <NextLink href="/insights" className="inline-flex items-center gap-2 text-small text-primary hover:text-brand">
            <ArrowLeftIcon className="size-4" />
            Back
          </NextLink>

          <div className="overflow-hidden rounded-[8px] bg-surface-base-soft">
            {post.featuredImage.heroUrl ?? post.featuredImage.url ? (
              <Image
                src={post.featuredImage.heroUrl ?? post.featuredImage.url ?? ''}
                alt={post.featuredImage.alt}
                width={post.featuredImage.width ?? 1600}
                height={post.featuredImage.height ?? 900}
                sizes="(min-width: 1280px) 912px, (min-width: 640px) calc(100vw - 5rem), calc(100vw - 2rem)"
                priority
                className="aspect-[16/9] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[16/9] items-center justify-center text-secondary">Placeholder</div>
            )}
          </div>

          <div className="grid gap-4 border-b border-default pb-6 text-small text-secondary sm:grid-cols-3 sm:items-start">
            <AuthorMetaCell
              avatar={
                post.author.avatar?.url
                  ? {
                      alt: post.author.avatar.alt,
                      url: post.author.avatar.url
                    }
                  : undefined
              }
              name={post.author.name}
            />
            <MetaCell label="Published">{formatInsightDate(post.publishedAt)}</MetaCell>
            <MetaCell label="Category">{post.category.title}</MetaCell>
          </div>

          <div className="flex flex-col gap-6">
            <h1 className="font-heading text-[2.25rem] leading-[2.75rem] text-primary sm:text-[2.375rem] sm:leading-[2.875rem] lg:text-[3.25rem] lg:leading-[3.75rem]">
              {post.title}
            </h1>
            <InsightsRichText document={post.body} />
          </div>

          {previewSession.isEnabled ? (
            <LeavePreviewBanner message="Preview mode is enabled for this article." redirectTo={`/insights/${slug}`} />
          ) : null}
        </div>

        {relatedPosts.length ? (
          <div className="mt-16 flex w-full flex-col gap-5 lg:mt-20">
            <h2 className="font-heading text-[1.875rem] leading-[2.25rem] text-primary sm:text-[2rem] sm:leading-[2.375rem]">
              Related Articles
            </h2>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {relatedPosts.map((relatedPost) => (
                <InsightCard key={relatedPost.id} post={relatedPost} variant="compact" />
              ))}
            </div>
          </div>
        ) : null}
      </Container>

      <Newsletter />
      <Footer />
    </>
  );
}

function MetaCell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-tertiary">{label}</p>
      <div className="text-primary">{children}</div>
    </div>
  );
}

function AuthorMetaCell({
  avatar,
  name
}: {
  avatar?: {
    alt: string;
    url: string;
  };
  name: string;
}) {
  if (!avatar) return <MetaCell label="Author">{name}</MetaCell>;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_auto] gap-x-3 gap-y-1 text-small">
      <Image
        src={avatar.url}
        alt={avatar.alt}
        width={40}
        height={40}
        sizes="40px"
        className="row-span-2 size-10 self-center rounded-[4px] object-cover"
      />
      <p className="text-tertiary">Author</p>
      <p className="text-primary">{name}</p>
    </div>
  );
}
