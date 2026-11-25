'use client';

import { type ReactNode, useState } from 'react';

import { Button } from '@zivoe/ui/core/button';
import { Card, CardContent, CardHeader, CardTitle } from '@zivoe/ui/core/card';
import { Skeleton } from '@zivoe/ui/core/skeleton';
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

/**
 * The three email toggles and Save. `standalone` is `/unsubscribe`'s card, reached from an email with or
 * without a session; `settings` is Settings → Notifications, with its heading and Save above the card.
 */
export default function EmailPreferencesForm({
  initialPreferences,
  token,
  variant = 'standalone'
}: {
  initialPreferences: EmailPreferences;
  token: string | null;
  variant?: 'standalone' | 'settings';
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
      ...ROW_COPY.transactionReceipts,
      selected: preferences.transactionReceipts,
      onChange: (selected: boolean) => setPreferences((current) => ({ ...current, transactionReceipts: selected }))
    },
    {
      ...ROW_COPY.productTips,
      selected: preferences.productTips,
      onChange: (selected: boolean) => setPreferences((current) => ({ ...current, productTips: selected }))
    },
    {
      title: ROW_COPY.newsletter.title,
      description:
        preferences.newsletter === null
          ? 'Newsletter preference is temporarily unavailable. Please try again later.'
          : ROW_COPY.newsletter.description,
      selected: preferences.newsletter ?? false,
      isDisabled: preferences.newsletter === null,
      onChange: (selected: boolean) =>
        setPreferences((current) => (current.newsletter === null ? current : { ...current, newsletter: selected }))
    }
  ];

  const list = (
    <PreferenceList
      rows={rows.map((row) => ({
        ...row,
        control: (
          <Switch
            aria-label={row.title}
            isSelected={row.selected}
            isDisabled={row.isDisabled}
            onChange={row.onChange}
          />
        )
      }))}
    />
  );

  const save = (label: string, { className, size }: { className?: string; size?: 'm' } = {}) => (
    <Button
      className={className}
      size={size}
      isPending={mutation.isPending}
      pendingContent="Saving..."
      isDisabled={mutation.isPending || !hasChanges}
      onPress={handleSave}
    >
      {label}
    </Button>
  );

  if (variant === 'settings') return <SettingsSection save={save('Save preferences', { size: 'm' })} list={list} />;

  return (
    <div className="mx-auto max-w-157.5">
      <div className="rounded-2xl bg-surface-elevated p-2">
        <div className="rounded-xl bg-surface-base p-4 shadow-xs">
          {list}
          <div className="pt-4">{save('Save', { className: 'w-full' })}</div>
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-100 text-center text-small text-tertiary">
        Looking to unsubscribe from all email notifications? Turn off every available toggle above and click save.
      </p>
    </div>
  );
}

const ROW_COPY = {
  transactionReceipts: {
    title: 'Transaction Receipts',
    description: 'Receive email confirmations for deposits and redemptions'
  },
  productTips: { title: 'Product Tips', description: 'Reminders and helpful product tips' },
  newsletter: { title: 'Newsletter', description: 'Product updates, announcements, and market insights' }
};

/**
 * Settings → Notifications while its preferences load: the same section, with the switches as
 * placeholders and Save disabled, as it first shows, so nothing moves when the page arrives.
 */
export function EmailPreferencesSettingsSkeleton() {
  return (
    <SettingsSection
      save={
        <Button size="m" isDisabled>
          Save preferences
        </Button>
      }
      list={
        <PreferenceList
          rows={Object.values(ROW_COPY).map((row) => ({
            ...row,
            control: <Skeleton className="h-7 w-12 shrink-0 rounded-full" />
          }))}
        />
      }
    />
  );
}

function SettingsSection({ save, list }: { save: ReactNode; list: ReactNode }) {
  return (
    <Card aria-labelledby="email-notifications-title">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle id="email-notifications-title">Email notifications</CardTitle>
          <p className="text-small text-secondary">Choose the emails you receive across your accounts.</p>
        </div>
        {save}
      </CardHeader>

      {/* The rows carry their own vertical padding. */}
      <CardContent className="py-2 sm:py-2">{list}</CardContent>
    </Card>
  );
}

function PreferenceList({ rows }: { rows: Array<{ title: string; description: string; control: ReactNode }> }) {
  return (
    <div className="flex flex-col">
      {rows.map((row, index) => (
        <div key={row.title}>
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex-1">
              <p className="text-leading font-medium text-primary">{row.title}</p>
              <p className="text-small text-secondary">{row.description}</p>
            </div>
            {row.control}
          </div>
          {index < rows.length - 1 && <div className="border-t border-default" />}
        </div>
      ))}
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
