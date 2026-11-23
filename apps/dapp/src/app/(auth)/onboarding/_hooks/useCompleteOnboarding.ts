'use client';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';

import { toast } from '@zivoe/ui/core/sonner';

import { completeOnboarding } from '@/server/actions/onboarding';

import { onboardedDestination } from '@/lib/lighthouse';
import { type OnboardingFormData } from '@/lib/schemas/onboarding';
import { type OrganizationDetailsFormData } from '@/lib/schemas/organizations';
import { AppError, onTxError } from '@/lib/utils';

/**
 * Where onboarding ends: the dashboard, or the validated page that sent the user here (`next`,
 * lib/lighthouse.ts): an invitation, `/verification`, or a Lighthouse page reached through the pass route.
 * Any of them takes a full load, since the pass route is an API route that can end cross-origin.
 */
export function useLeaveOnboarding({ next }: { next?: string }) {
  const router = useRouter();
  return () => (next ? window.location.assign(onboardedDestination(next)) : router.push('/'));
}

/**
 * Saves onboarding in one write. With an organization, `onOrganizationCreated` takes over, for the invite
 * step; otherwise the user leaves onboarding at once.
 */
export function useCompleteOnboarding({
  next,
  onOrganizationCreated
}: {
  next?: string;
  onOrganizationCreated?: (organizationId: string) => void;
}) {
  const leave = useLeaveOnboarding({ next });

  return useMutation({
    mutationFn: async (input: { profile: OnboardingFormData; organization?: OrganizationDetailsFormData }) => {
      const { error, organizationId, alreadyOnboarded } = await completeOnboarding(input);
      if (error) throw new AppError({ message: 'Onboarding Failed', exception: error, capture: false });
      return { organizationId, alreadyOnboarded, hadOrganization: !!input.organization };
    },

    onSuccess: ({ organizationId, alreadyOnboarded, hadOrganization }) => {
      // Finished in another tab: nothing from this one was saved, a company included.
      if (alreadyOnboarded) {
        toast({
          type: 'warning',
          title: 'Your account is already set up',
          description: hadOrganization ? 'Create your organization from Settings.' : undefined
        });
        return leave();
      }

      toast({
        type: 'success',
        title: 'Welcome to Zivoe!',
        description: 'Your account has been set up successfully.'
      });

      if (organizationId && onOrganizationCreated) onOrganizationCreated(organizationId);
      else leave();
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
