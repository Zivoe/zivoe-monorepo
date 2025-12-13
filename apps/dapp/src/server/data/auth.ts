import 'server-only';

import { cache } from 'react';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/server/auth';

export const getUser = cache(async () => {
  const data = await auth.api.getSession({
    headers: await headers()
  });

  return { user: data?.user };
});

export const verifySession = cache(async () => {
  const { user } = await getUser();

  if (!user) {
    redirect('/sign-in');
  }

  return { user };
});
