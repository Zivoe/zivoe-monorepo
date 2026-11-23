'use client';

import { useRef, useState } from 'react';

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
import { AGREEMENTS } from './verification-documents';
import { organizationIdOf, verificationHref } from './verification-href';
import { stepCountOf } from './verification-steps';

const FAILED_COPY = 'Could not save your agreement. Please try again.';
const UNTICKED_COPY = 'Please accept the agreements to continue.';
const UNTICKED_ID = 'agreements-unticked';

/**
 * Step two of `/verification`: the agreements, each opening in a new tab, and one checkbox that
 * accepts them all for the selected subject. Continue without the box ticked says so under it and moves focus
 * there; with it ticked, Continue records the acceptance (`acceptAgreements`), then moves on to the Persona flow. Once accepted, by this person or by
 * another member of the organization, the step shows the box ticked and locked, and Continue only moves on.
 */
export function AgreementsStep({ subject, isAccepted }: { subject: SubjectOption; isAccepted: boolean }) {
  const router = useRouter();
  const [isTicked, setIsTicked] = useState(false);
  // Continue pressed with the box unticked: the box shows the error until it is ticked.
  const [isUnticked, setIsUnticked] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const organizationId = organizationIdOf(subject);
  const proceed = () => router.push(verificationHref({ organizationId, step: 'identity' }));

  const accept = useMutation({
    // Wrapped: a server action given React Query's second argument would send it to the server too.
    mutationFn: (input: { subjectId: string }) => acceptAgreements(input)
  });
  // The answer is handled per call, not on the mutation: those callbacks stop once the step unmounts, so an
  // acceptance that lands after a switch to another account does not pull the page back here.
  const submit = () =>
    accept.mutate(
      { subjectId: subject.id },
      {
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
      }
    );

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
            {AGREEMENTS.map(({ title, href }) => (
              <li key={href} className="border-default not-last:border-b">
                <NextLink
                  href={href}
                  target="_blank"
                  // A PDF, not a page: nothing to fetch before it is opened.
                  prefetch={false}
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
              inputRef={checkboxRef}
              isSelected={isAccepted || isTicked}
              onChange={(isSelected) => {
                setIsTicked(isSelected);
                if (isSelected) setIsUnticked(false);
              }}
              isDisabled={isAccepted || isSaving}
              isInvalid={isUnticked}
              aria-describedby={isUnticked ? UNTICKED_ID : undefined}
              className="items-start leading-normal break-normal"
            >
              I have read and agree to these documents.
            </Checkbox>

            {/* An alert: focus reaches the checkbox before this renders, so its description alone goes unread. */}
            {isUnticked ? (
              <p id={UNTICKED_ID} role="alert" className="text-small text-alert">
                {UNTICKED_COPY}
              </p>
            ) : null}
          </div>
        </div>

        <Button
          fullWidth
          isPending={isSaving}
          pendingContent="Saving..."
          onPress={() => {
            setRefusal(null);
            if (isAccepted) return proceed();
            if (!isTicked) {
              setIsUnticked(true);
              checkboxRef.current?.focus();
              return;
            }
            submit();
          }}
        >
          Continue
        </Button>
      </div>
    </>
  );
}
