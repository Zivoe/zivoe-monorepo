'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from '@zivoe/ui/core/sonner';

import { saveEmailPreferencesAction } from '@/server/actions/email-preferences';

import { queryKeys } from '@/lib/query-keys';
import { onTxError } from '@/lib/utils';

type SaveEmailPreferencesInput = {
  currentNewsletter: boolean | null;
  currentProductTips: boolean;
  currentTransactionReceipts: boolean;
  newsletter?: boolean;
  productTips?: boolean;
  transactionReceipts?: boolean;
};

export const useSaveEmailPreferences = ({ token }: { token: string | null }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (changes: SaveEmailPreferencesInput) => {
      const result = await saveEmailPreferencesAction({
        token: token ?? undefined,
        currentNewsletter: changes.currentNewsletter,
        currentProductTips: changes.currentProductTips,
        currentTransactionReceipts: changes.currentTransactionReceipts,
        newsletter: changes.newsletter,
        productTips: changes.productTips,
        transactionReceipts: changes.transactionReceipts
      });

      if (result.error) throw new Error(result.error);
      if (!result.data) throw new Error('Failed to save preferences.');

      return { preferences: result.data };
    },

    onSuccess: ({ preferences }) => {
      queryClient.setQueryData(queryKeys.app.emailPreferences({ token: token ?? undefined }), preferences);

      toast({
        type: 'success',
        title: 'Preferences saved',
        description: 'Your email preferences have been updated.'
      });
    },

    onError: (error, variables) => {
      onTxError({
        err: error,
        defaultToastMsg: 'Failed to update preferences.',
        sentry: { flow: 'save-email-preferences', extras: variables }
      });
    }
  });
};
