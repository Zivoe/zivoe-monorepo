'use client';

import { type ReactNode } from 'react';

import { useMutation } from '@tanstack/react-query';
import posthog from 'posthog-js';

import { Button, type ButtonProps } from '@zivoe/ui/core/button';
import { toast } from '@zivoe/ui/core/sonner';

import { signOutAction } from '@/server/actions/auth';

import { handlePromise } from '@/lib/utils';

/**
 * Signs out from a page with no account menu, so someone signed in with the wrong account can switch:
 * an invitation for another address, the agreements gate. `next` is the page the next sign-in returns to.
 */
export function SignOutButton({
  next,
  variant,
  children
}: {
  next?: string;
  variant: ButtonProps['variant'];
  children: ReactNode;
}) {
  const signOut = useMutation({
    mutationFn: async () => {
      const { res, err } = await handlePromise(signOutAction({ next }));
      // The action redirects to the sign-in page, which reaches the client as a thrown redirect.
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) posthog.reset();
      else if (err || res?.error) toast({ type: 'error', title: 'Error signing out' });
    }
  });

  return (
    <Button
      variant={variant}
      fullWidth
      onPress={() => signOut.mutate()}
      isPending={signOut.isPending}
      pendingContent="Signing out..."
    >
      {children}
    </Button>
  );
}
