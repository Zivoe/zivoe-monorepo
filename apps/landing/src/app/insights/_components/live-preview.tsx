'use client';

import { useRouter } from 'next/navigation';

import { RefreshRouteOnSave as PayloadRefreshRouteOnSave } from '@payloadcms/live-preview-react';

export function InsightsLivePreview({ serverURL }: { serverURL: string }) {
  const router = useRouter();

  return <PayloadRefreshRouteOnSave refresh={() => router.refresh()} serverURL={serverURL} />;
}
