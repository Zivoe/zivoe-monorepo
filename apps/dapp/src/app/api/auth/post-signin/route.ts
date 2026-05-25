import { type NextRequest, NextResponse } from 'next/server';

import { getOnboardedStatus } from '@/server/data/auth';

export async function GET(request: NextRequest) {
  const { isOnboarded } = await getOnboardedStatus();
  const destination = isOnboarded ? '/' : '/onboarding';

  return NextResponse.redirect(new URL(destination, request.url));
}
