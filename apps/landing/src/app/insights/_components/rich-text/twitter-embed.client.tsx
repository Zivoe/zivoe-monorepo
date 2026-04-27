'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Script from 'next/script';

import { parseTwitterEmbedUrl } from '@zivoe/cms-types/insights-embeds';

import { EmbedFallback } from './embeds';

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        createTweet?: (
          tweetId: string,
          element: HTMLElement,
          options?: Record<string, unknown>
        ) => Promise<HTMLElement>;
      };
    };
  }
}

export function TwitterEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedTweetIdRef = useRef<null | string>(null);
  const parsed = parseTwitterEmbedUrl(url);
  const [hasFailed, setHasFailed] = useState(false);
  const [isScriptReady, setIsScriptReady] = useState(false);

  const renderTweet = useCallback(() => {
    if (!parsed || !containerRef.current) return;
    if (renderedTweetIdRef.current === parsed.tweetId) return;

    const createTweet = window.twttr?.widgets?.createTweet;
    if (!createTweet) return;

    setHasFailed(false);
    containerRef.current.innerHTML = '';
    renderedTweetIdRef.current = parsed.tweetId;

    void createTweet(parsed.tweetId, containerRef.current, {
      align: 'center',
      dnt: true
    }).catch(() => {
      renderedTweetIdRef.current = null;
      setHasFailed(true);
    });
  }, [parsed]);

  useEffect(() => {
    if (window.twttr?.widgets?.createTweet) {
      setIsScriptReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isScriptReady) return;
    renderTweet();
  }, [isScriptReady, renderTweet, url]);

  useEffect(() => {
    renderedTweetIdRef.current = null;
    setHasFailed(false);

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  }, [parsed?.tweetId]);

  if (!parsed) {
    return <EmbedFallback href={url} provider="X" />;
  }

  return (
    <div>
      <div ref={containerRef} />
      {hasFailed ? <EmbedFallback href={parsed.canonicalUrl} provider="X" /> : null}
      <Script
        id="twitter-wjs"
        src="https://platform.twitter.com/widgets.js"
        strategy="lazyOnload"
        onReady={() => setIsScriptReady(true)}
      />
    </div>
  );
}
