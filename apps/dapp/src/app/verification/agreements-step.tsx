'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Checkbox } from '@zivoe/ui/core/checkbox';
import { NextLink } from '@zivoe/ui/core/link';
import { toast } from '@zivoe/ui/core/sonner';
import { DocumentIcon, ExternalLinkIcon } from '@zivoe/ui/icons';

import { acceptAgreements } from '@/server/actions/agreements';

import { ORGANIZATION_ERROR_COPY } from '@/lib/organization-copy';

import { Auth } from '@/app/(auth)/_components/common';

import { type SubjectOption } from './account-switcher';
import { OFFERING_AGREEMENTS } from './offering-documents';
import { organizationIdOf, verificationHref } from './verification-href';
import { stepCountOf } from './verification-steps';

const FAILED_COPY = 'Could not save your agreement. Please try again.';

/**
 * Step two of `/verification`: the offering agreements, each opening in a new tab, and one checkbox that
 * accepts them all for the selected subject. Continue stays disabled until it is ticked, records the
 * acceptance (`acceptAgreements`), then moves on to the Persona flow. Once accepted, by this person or by
 * another member of the organization, the step shows the box ticked and locked, and Continue only moves on.
 */
export function AgreementsStep({ subject, acceptedAt }: { subject: SubjectOption; acceptedAt: Date | null }) {
  const router = useRouter();
  const [isTicked, setIsTicked] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const organizationId = organizationIdOf(subject);
  const proceed = () => router.push(verificationHref({ organizationId, step: 'identity' }));

  const accept = useMutation({
    // Wrapped: a server action given React Query's second argument would send it to the server too.
    mutationFn: (input: { subjectId: string }) => acceptAgreements(input),
    onSuccess: (result) => {
      if (result.ok) return proceed();
      if (result.code === 'not_member') {
        // Removed with the page open: the refresh takes them to their own page, so the words go in a toast.
        toast({ type: 'warning', title: ORGANIZATION_ERROR_COPY.not_member });
        router.refresh();
        return;
      }
      // Signed out or behind the terms: the refresh lets the page's own redirect take over.
      if (result.code === 'unauthorized') router.refresh();
      setRefusal(FAILED_COPY);
    },
    onError: () => setRefusal(FAILED_COPY)
  });

  const isAccepted = acceptedAt !== null;
  // Pending, and once it has succeeded, until the next step replaces this one.
  const isSaving = accept.isPending || (accept.isSuccess && accept.data.ok);

  return (
    <>
      <Auth.Header
        title="Review the agreements"
        description="Open each document, then confirm your agreement to continue."
      >
        <Auth.StepIndicator
          onBack={isSaving ? undefined : () => router.push(verificationHref({ organizationId, step: 'details' }))}
        >
          {stepCountOf('agreements')}
        </Auth.StepIndicator>
      </Auth.Header>

      {refusal ? (
        <Callout variant="warning" role="alert">
          {refusal}
        </Callout>
      ) : null}

      <div className="flex flex-col gap-11">
        <div className="flex flex-col gap-6">
          <ul
            aria-label="Agreements"
            className="flex flex-col rounded-2xl border border-default bg-surface-elevated p-2"
          >
            {OFFERING_AGREEMENTS.map(({ title, href }) => (
              <li key={href} className="border-default not-last:border-b">
                <NextLink
                  href={href}
                  target="_blank"
                  className="group flex items-center justify-between gap-4 rounded-xl px-4 py-5 hover:bg-element-neutral-light focus-visible:bg-element-neutral-subtle focus-visible:outline-hidden sm:py-6"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <DocumentIcon aria-hidden="true" className="size-5 shrink-0 text-icon-default" />
                    <span className="text-regular text-primary group-hover:text-brand sm:text-leading">{title}</span>
                  </span>
                  <ExternalLinkIcon
                    aria-hidden="true"
                    className="size-5 shrink-0 text-tertiary group-hover:text-primary group-focus-visible:text-primary"
                  />
                  <span className="sr-only">(opens in a new tab)</span>
                </NextLink>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2">
            <Checkbox
              isSelected={isAccepted || isTicked}
              onChange={setIsTicked}
              isDisabled={isAccepted || isSaving}
              className="items-start leading-normal break-normal"
            >
              I have read and agree to these documents.
            </Checkbox>
            {/* UTC: the server and the browser must print the same day. */}
            {acceptedAt ? (
              <p className="pl-7 text-small text-secondary">
                Accepted on {acceptedAt.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' })}.
              </p>
            ) : null}
          </div>
        </div>

        <Button
          fullWidth
          isDisabled={!isAccepted && !isTicked}
          isPending={isSaving}
          pendingContent="Saving..."
          onPress={() => {
            setRefusal(null);
            if (isAccepted) return proceed();
            accept.mutate({ subjectId: subject.id });
          }}
        >
          Continue
        </Button>
      </div>
    </>
  );
}
