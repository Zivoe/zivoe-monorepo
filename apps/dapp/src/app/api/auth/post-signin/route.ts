import { NextRequest, NextResponse } from 'next/server';

import { getOnboardedStatus } from '@/server/data/auth';

export async function GET(request: NextRequest) {
  const { isOnboarded } = await getOnboardedStatus();
  return NextResponse.redirect(new URL(isOnboarded ? '/' : '/onboarding', request.url));
}
