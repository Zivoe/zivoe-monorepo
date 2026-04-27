import { draftMode } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { isValidInsightsPreviewLink } from '@/server/insights/preview';

export async function GET(request: NextRequest) {
  const expires = request.nextUrl.searchParams.get('expires');
  const signature = request.nextUrl.searchParams.get('signature');
  const slug = request.nextUrl.searchParams.get('slug');

  if (!expires || !signature || !slug) {
    return NextResponse.json({ error: 'Missing preview parameters' }, { status: 400 });
  }

  if (Number(expires) < Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: 'Preview link expired' }, { status: 401 });
  }

  if (!isValidInsightsPreviewLink({ expires, signature, slug })) {
    return NextResponse.json({ error: 'Invalid preview signature' }, { status: 401 });
  }

  const draft = await draftMode();
  draft.enable();

  return NextResponse.redirect(new URL(`/insights/${slug}`, request.url));
}
