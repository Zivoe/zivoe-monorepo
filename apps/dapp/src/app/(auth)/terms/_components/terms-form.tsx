'use client';

import { useRef } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import * as Sentry from '@sentry/nextjs';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Checkbox } from '@zivoe/ui/core/checkbox';
import { Link } from '@zivoe/ui/core/link';
import { LATEST_LEGAL_DOCS_VERSION } from '@zivoe/ui/lib/legal-docs';

import { LINKS } from '@/types/constants';

import { continueAfterSignInAction } from '@/server/actions/auth';
import { acceptTerms } from '@/server/actions/terms';

import { withNext } from '@/lib/lighthouse';
import { AppError, handlePromise, onTxError } from '@/lib/utils';

import { Auth } from '../../_components/common';

const termsSchema = z.object({
  isAccepted: z.boolean().refine((isAccepted) => isAccepted, 'Please accept the terms to continue')
});

type TermsFormData = z.infer<typeof termsSchema>;

/** `isUpdate` tells a user who accepted an earlier version that the terms changed, instead of greeting them as new. */
export default function TermsForm({ next, isUpdate }: { next?: string; isUpdate: boolean }) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const { control, handleSubmit } = useForm<TermsFormData>({
    resolver: zodResolver(termsSchema),
    defaultValues: { isAccepted: false }
  });

  const acceptance = useMutation({
    mutationFn: async (): Promise<{ isSignedOut?: true }> => {
      const { error, isOutdated, isSignedOut } = await acceptTerms({ version: LATEST_LEGAL_DOCS_VERSION });
      // Not a failure: reloading shows the new version's PDFs to review and accept.
      if (isOutdated)
        throw new AppError({
          message: 'The terms were just updated. Reload the page to review them.',
          type: 'warning',
          capture: false
        });
      // Not a failure either: the session ended while the page was open, and no retry can save without one.
      if (isSignedOut) return { isSignedOut };
      if (error) throw new AppError({ message: 'Failed to Accept Terms', exception: error, capture: false });
      return {};
    },

    onSuccess: async ({ isSignedOut }) => {
      // Sign-in brings the user back to the terms, and on to `next`, once they are signed in again.
      if (isSignedOut) return window.location.assign(withNext('/sign-in', next));

      // A full load: post-signin picks the page in `next` or the way back to Lighthouse, which can end cross-origin.
      if (next) return window.location.assign(withNext('/api/auth/post-signin', next));

      // Otherwise the action's redirect brings the dashboard in one request, with no full load: its promise rejects
      // with NEXT_REDIRECT while the router navigates. Any other failure falls back to the full load.
      const { err } = await handlePromise(continueAfterSignInAction());
      if (err && !(err instanceof Error && err.message.includes('NEXT_REDIRECT'))) {
        Sentry.captureException(err, { tags: { source: 'SERVER', flow: 'accept-terms' } });
        window.location.assign('/api/auth/post-signin');
      }
    },

    onError: (err) => {
      onTxError({
        err,
        defaultToastMsg: 'An unexpected error occurred. Please try again.',
        sentry: { flow: 'accept-terms', extras: {} }
      });
    }
  });

  return (
    <>
      <Auth.Container>
        <Auth.Header
          title={isUpdate ? "We've Updated Our Terms" : 'Terms of Use'}
          description={
            isUpdate
              ? 'Our terms have changed since you last accepted them. Please review and accept the updated terms to keep using Zivoe.'
              : 'Before you continue, please review and accept our terms. By proceeding, you confirm that you have read them and agree to comply with our policies.'
          }
        />

        {/* Continue without the box ticked shows the error and moves focus to the checkbox. */}
        <form
          onSubmit={handleSubmit(
            () => acceptance.mutate(),
            () => checkboxRef.current?.focus()
          )}
          className="flex flex-col gap-11"
        >
          <Controller
            control={control}
            name="isAccepted"
            render={({ field: { value, onChange, onBlur }, fieldState: { error, invalid } }) => (
              <div className="flex flex-col gap-2">
                {/* The label style breaks anywhere and the links are nowrap boxes; undo both so the sentence wraps as prose. */}
                <Checkbox
                  inputRef={checkboxRef}
                  isSelected={value}
                  onChange={onChange}
                  onBlur={onBlur}
                  isInvalid={invalid}
                  isDisabled={acceptance.isPending || acceptance.isSuccess}
                  aria-describedby={error ? TERMS_ERROR_ID : undefined}
                  className="items-start break-normal"
                >
                  <span>
                    I have read and accept the <TermsLink href={LINKS.TERMS_OF_USE}>Terms of Use</TermsLink> and the{' '}
                    <TermsLink href={LINKS.PRIVACY_POLICY}>Privacy Policy</TermsLink>, and I give my{' '}
                    <TermsLink href={LINKS.ELECTRONIC_CONSENT}>Electronic Consent</TermsLink> to receive communications
                    and records from Zivoe.
                  </span>
                </Checkbox>

                {/* An alert: focus reaches the checkbox before this renders, so its description alone goes unread. */}
                {error && (
                  <p id={TERMS_ERROR_ID} role="alert" className="text-small text-alert">
                    {error.message}
                  </p>
                )}
              </div>
            )}
          />

          {/* Stays pending after success, until the full page load replaces the form. */}
          <Button
            type="submit"
            fullWidth
            isPending={acceptance.isPending || acceptance.isSuccess}
            pendingContent="Continuing..."
          >
            Continue
          </Button>
        </form>
      </Auth.Container>

      <Auth.CopyrightFooter />
    </>
  );
}

const TERMS_ERROR_ID = 'terms-error';

function TermsLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      hideExternalLinkIcon
      variant="link-primary"
      size="m"
      className="inline whitespace-normal"
    >
      {children}
    </Link>
  );
}
