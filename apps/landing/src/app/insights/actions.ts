'use server';

import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';

function getSafeRedirectTarget(target: string) {
  if (!target.startsWith('/') || target.startsWith('//')) return '/insights';

  return target;
}

export async function leaveInsightsPreview(redirectTo: string) {
  const draft = await draftMode();
  draft.disable();

  redirect(getSafeRedirectTarget(redirectTo));
}
