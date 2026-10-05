'use client';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';

import { toast } from '@zivoe/ui/core/sonner';

import { completeOnboarding } from '@/server/actions/onboarding';

import { withNext } from '@/lib/lighthouse';
import { type OnboardingFormData } from '@/lib/schemas/onboarding';
import { AppError, onTxError } from '@/lib/utils';

/** The terms follow onboarding; `next`, the validated page to return to after them (lib/lighthouse.ts), rides along. */
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

      router.push(withNext('/terms', next));
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
