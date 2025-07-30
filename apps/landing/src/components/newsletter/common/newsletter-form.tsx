'use client';

import { useRef } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import * as Sentry from '@sentry/nextjs';
import { useMutation } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';
import { toast } from '@zivoe/ui/core/sonner';

import { handlePromise } from '@/lib/utils';

import { env } from '@/env';

import { joinNewsletter } from './join-newsletter';

const WITH_TURNSTILE = env.NEXT_PUBLIC_ENV === 'production';

const newsletterFormSchema = z.object({
  email: z.string().min(1, 'Email is required').email({ message: 'Invalid email address' })
});

type NewsletterFormSchema = z.infer<typeof newsletterFormSchema>;

export default function NewsletterForm() {
  const { turnstileRef, turnstilePromiseRef, executeTurnstile } = useTurnstile();
  const joinNewsletter = useJoinNewsletter();

  const form = useForm<NewsletterFormSchema>({
    resolver: zodResolver(newsletterFormSchema),
    defaultValues: { email: '' },
    mode: 'onBlur'
  });

  const handleSubmit = async (data: NewsletterFormSchema) => {
    let turnstileToken = '';

    if (WITH_TURNSTILE) {
      const { res: token, err: tokenErr } = await handlePromise(executeTurnstile());

      if (!token || tokenErr) {
        toast({ type: 'error', title: 'Error verifying user' });
        return;
      }

      turnstileToken = token;
    }

    await joinNewsletter.mutate({ ...data, turnstileToken });
  };

  return (
    <>
      <form
        className="flex w-full flex-col justify-center gap-4 sm:w-fit xl:flex-row xl:gap-2"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState: { invalid, error } }) => (
            <Input
              type="email"
              isRequired
              placeholder="Your email address"
              errorMessage={error?.message}
              isInvalid={invalid}
              className="w-full sm:w-[30rem] xl:w-[17.5rem]"
              {...field}
            />
          )}
        />

        <Button type="submit" isPending={joinNewsletter.isPending} className="w-full sm:w-auto">
          Sign up
        </Button>
      </form>

      {WITH_TURNSTILE && (
        <Turnstile
          options={{ execution: 'execute', appearance: 'execute' }}
          siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          onSuccess={(token) => turnstilePromiseRef.current?.resolve(token)}
          onError={(error) => turnstilePromiseRef.current?.reject(new Error(error))}
          onBeforeInteractive={() => toast({ type: 'warning', title: 'Verify you are human to continue' })}
          ref={turnstileRef}
        />
      )}
    </>
  );
}

const useJoinNewsletter = () => {
  return useMutation({
    mutationFn: async ({ email, turnstileToken }: { email: string; turnstileToken: string }) => {
      const { res, err } = await handlePromise(joinNewsletter({ email, turnstileToken }));

      if (err || !res) throw new Error('Error joining newsletter, please try again');
      if (res.error || !res.message) throw new Error(res.error);

      return { message: res.message };
    },

    onSuccess: ({ message }) => toast({ type: 'success', title: message }),
    onError: (error) => {
      toast({ type: 'error', title: error.message });

      Sentry.captureException(error, {
        tags: { source: 'MUTATION', flow: 'newsletter' },
        extra: { toastMsg: error.message }
      });
    }
  });
};

type TurnstilePromiseRef = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
};

const useTurnstile = () => {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const turnstilePromiseRef = useRef<TurnstilePromiseRef>(null);

  async function executeTurnstile(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      turnstilePromiseRef.current = { resolve, reject };

      try {
        // Turnstile token is valid only once so in the case of an error with the sign-up process, we need to reset before executing again
        turnstileRef.current?.reset();
        turnstileRef.current?.execute();
      } catch (error) {
        reject(error);
      }
    });
  }

  return { turnstileRef, turnstilePromiseRef, executeTurnstile };
};
