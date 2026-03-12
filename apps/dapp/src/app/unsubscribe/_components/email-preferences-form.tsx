'use client';

import { useState } from 'react';

import { Button } from '@zivoe/ui/core/button';
import { Switch } from '@zivoe/ui/core/switch';

import { type EmailPreferences } from '@/server/data/email-preferences';

import { useSaveEmailPreferences } from '@/app/unsubscribe/_hooks/useSaveEmailPreferences';

type SaveEmailPreferencesInput = {
  currentNewsletter: boolean | null;
  currentProductTips: boolean;
  currentTransactionReceipts: boolean;
  newsletter?: boolean;
  productTips?: boolean;
  transactionReceipts?: boolean;
};

export default function EmailPreferencesForm({
  initialPreferences,
  token
}: {
  initialPreferences: EmailPreferences;
  token: string | null;
}) {
  const [savedPreferences, setSavedPreferences] = useState<EmailPreferences>(initialPreferences);
  const [preferences, setPreferences] = useState<EmailPreferences>(initialPreferences);

  const hasChanges =
    preferences.newsletter !== savedPreferences.newsletter ||
    preferences.productTips !== savedPreferences.productTips ||
    preferences.transactionReceipts !== savedPreferences.transactionReceipts;

  const mutation = useSaveEmailPreferences({ token });

  const handleSave = () => {
    const changes = getChangedPreferences({
      current: preferences,
      saved: savedPreferences
    });

    mutation.mutate(changes, {
      onSuccess: ({ preferences: data }) => {
        setSavedPreferences(data);
        setPreferences(data);
      }
    });
  };

  const rows = [
    {
      title: 'Transaction Receipts',
      description: 'Receive email confirmations for deposits and redemptions',
      selected: preferences.transactionReceipts,
      onChange: (selected: boolean) => setPreferences((current) => ({ ...current, transactionReceipts: selected }))
    },
    {
      title: 'Product Tips',
      description: 'Reminders and helpful product tips',
      selected: preferences.productTips,
      onChange: (selected: boolean) => setPreferences((current) => ({ ...current, productTips: selected }))
    },
    {
      title: 'Newsletter',
      description:
        preferences.newsletter === null
          ? 'Newsletter preference is temporarily unavailable. Please try again later.'
          : 'Product updates, announcements, and market insights',
      selected: preferences.newsletter ?? false,
      isDisabled: preferences.newsletter === null,
      onChange: (selected: boolean) =>
        setPreferences((current) => (current.newsletter === null ? current : { ...current, newsletter: selected }))
    }
  ];

  return (
    <div className="mx-auto max-w-[39.375rem]">
      <div className="rounded-2xl bg-surface-elevated p-2">
        <div className="rounded-xl bg-surface-base p-4 shadow-sm">
          <div className="flex flex-col">
            {rows.map((row, index) => (
              <div key={row.title}>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="flex-1">
                    <p className="text-leading font-medium text-primary">{row.title}</p>
                    <p className="text-small text-secondary">{row.description}</p>
                  </div>
                  <Switch isSelected={row.selected} isDisabled={row.isDisabled} onChange={row.onChange} />
                </div>
                {index < rows.length - 1 && <div className="border-t border-default" />}
              </div>
            ))}

            <div className="pt-4">
              <Button
                className="w-full"
                isPending={mutation.isPending}
                pendingContent="Saving..."
                isDisabled={mutation.isPending || !hasChanges}
                onPress={handleSave}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-[400px] text-center text-small text-tertiary">
        Looking to unsubscribe from all email notifications? Turn off every available toggle above and click save.
      </p>
    </div>
  );
}

function getChangedPreferences({
  current,
  saved
}: {
  current: EmailPreferences;
  saved: EmailPreferences;
}): SaveEmailPreferencesInput {
  const changes: SaveEmailPreferencesInput = {
    currentNewsletter: saved.newsletter,
    currentProductTips: saved.productTips,
    currentTransactionReceipts: saved.transactionReceipts
  };

  if (current.newsletter !== saved.newsletter && current.newsletter !== null) {
    changes.newsletter = current.newsletter;
  }

  if (current.productTips !== saved.productTips) {
    changes.productTips = current.productTips;
  }

  if (current.transactionReceipts !== saved.transactionReceipts) {
    changes.transactionReceipts = current.transactionReceipts;
  }

  return changes;
}
