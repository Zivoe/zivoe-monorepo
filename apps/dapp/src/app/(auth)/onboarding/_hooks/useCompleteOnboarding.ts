'use client';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';

import { toast } from '@zivoe/ui/core/sonner';

import { completeOnboarding } from '@/server/actions/onboarding';

import { onboardedDestination } from '@/lib/lighthouse';
import { type OnboardingFormData } from '@/lib/schemas/onboarding';
import { AppError, onTxError } from '@/lib/utils';

/** `next` is the validated Lighthouse page to return to once onboarded (lib/lighthouse.ts); without it the dashboard is next. */
export function useCompleteOnboarding({ next }: { next?: string } = {}) {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: OnboardingFormData) => {
      const { error } = await completeOnboarding(data);
      if (error) throw new AppError({ message: 'Onboarding Failed', exception: error, capture: false });
    },

    onSuccess: () => {
      toast({
        type: 'success',
        title: 'Welcome to Zivoe!',
        description: 'Your account has been set up successfully.'
      });

      // Returning to Lighthouse ends in a cross-origin redirect from the pass route, which the client router cannot follow.
      if (next) window.location.assign(onboardedDestination(next));
      else router.push('/');
    },

    onError: (err) => {
      onTxError({
        err,
        defaultToastMsg: 'An unexpected error occurred. Please try again.',
        sentry: { flow: 'onboarding', extras: {} }
      });
    }
  });
}
