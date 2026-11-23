'use client';

import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Checkbox } from '@zivoe/ui/core/checkbox';
import { NextLink } from '@zivoe/ui/core/link';
import { DocumentIcon, ExternalLinkIcon } from '@zivoe/ui/icons';

import { acceptAgreements } from '@/server/actions/agreements';

import { AGREEMENTS, LATEST_AGREEMENTS_VERSION } from '@/lib/agreements';

const FAILED_COPY = 'Could not save your agreement. Please try again.';
const OUTDATED_COPY = 'The agreements were just updated. Reload the page to review them.';
const UNTICKED_COPY = 'Please accept the agreements to continue.';
const UNTICKED_ID = 'agreements-unticked';

/**
 * The agreements in force, each opening in a new tab, one checkbox and Continue: the body of `/verification`'s
 * Agreements step and of `/agreements`. Continue without the box ticked says so under it and moves focus there;
 * with it ticked, Continue records the person's acceptance of the version shown (`acceptAgreements`) and calls
 * `onAccepted`, staying pending until the page moves on.
 */
export function AgreementsForm({ onAccepted }: { onAccepted: () => void }) {
  const router = useRouter();
  const [isTicked, setIsTicked] = useState(false);
  // Continue pressed with the box unticked: the box shows the error until it is ticked.
  const [isUnticked, setIsUnticked] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const accept = useMutation({
    // Wrapped: a server action given React Query's second argument would send it to the server too.
    mutationFn: () => acceptAgreements({ version: LATEST_AGREEMENTS_VERSION }),
    onSuccess: (result) => {
      if (result.ok) return onAccepted();
      // A deploy published new agreements while the page was open: only a reload shows them.
      if (result.code === 'outdated') return setRefusal(OUTDATED_COPY);
      // Signed out or behind the terms: the refresh lets the page's own redirect take over.
      if (result.code === 'unauthorized') router.refresh();
      setRefusal(FAILED_COPY);
    },
    onError: () => setRefusal(FAILED_COPY)
  });

  // Pending, and once it has succeeded, until the next page replaces this one.
  const isSaving = accept.isPending || (accept.isSuccess && accept.data.ok);

  return (
    <>
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
              isSelected={isTicked}
              onChange={(isSelected) => {
                setIsTicked(isSelected);
                if (isSelected) setIsUnticked(false);
              }}
              isDisabled={isSaving}
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
            if (!isTicked) {
              setIsUnticked(true);
              checkboxRef.current?.focus();
              return;
            }
            accept.mutate();
          }}
        >
          Continue
        </Button>
      </div>
    </>
  );
}
