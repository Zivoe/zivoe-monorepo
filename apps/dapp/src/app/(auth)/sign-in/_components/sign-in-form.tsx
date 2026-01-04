'use client';

import { useEffect, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile } from '@marsidev/react-turnstile';
import * as Sentry from '@sentry/nextjs';
import { Controller, useForm } from 'react-hook-form';
import { toast as sonnerToast } from 'sonner';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';
import { InputOTP, InputOTPGroup, InputOTPSlot, REGEXP_ONLY_DIGITS } from '@zivoe/ui/core/input-otp';
import { Link, LinkProps } from '@zivoe/ui/core/link';
import { Separator } from '@zivoe/ui/core/separator';
import { toast } from '@zivoe/ui/core/sonner';
import { ArrowLeftIcon, GoogleIcon, TwitterIcon } from '@zivoe/ui/icons';

import { LINKS, WITH_TURNSTILE } from '@/types/constants';

import { authClient } from '@/lib/auth-client';
import { handlePromise } from '@/lib/utils';

import { env } from '@/env';

import { useOtpResendRateLimit } from '../_hooks/useOtpResendRateLimit';
import { useTurnstile } from '../_hooks/useTurnstile';

type Step = 'EMAIL' | 'OTP';

export default function SignInForm() {
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>('EMAIL');
  const [email, setEmail] = useState('');
  const { turnstileRef, turnstilePromiseRef, executeTurnstile } = useTurnstile();

  const handleEmailSuccess = (data: EmailFormData) => {
    setEmail(data.email);
    setStep('OTP');
  };

  useEffect(() => {
    const error = searchParams.get('error');

    if (error) {
      // Small delay to ensure toast provider is mounted after hydration
      setTimeout(() => {
        toast({
          title: 'Sign in failed',
          type: 'error'
        });

        window.history.replaceState({}, '', '/sign-in');
      }, 0);
    }
  }, [searchParams]);

  return (
    <>
      <div className="flex max-w-[37rem] flex-1 flex-col items-center">
        {/* Top spacer for small height screens */}
        <div className="min-h-11 flex-1" />

        <div className="flex w-full flex-col gap-11">
          {step === 'EMAIL' ? (
            <>
              <Header
                title="Sign Up or Sign In"
                description={
                  <p className="text-regular text-secondary">
                    Enter your email to sign in to your account. If you don't have an account yet, one will be created
                    for you.
                  </p>
                }
              />

              <EmailStepForm onSuccess={handleEmailSuccess} executeTurnstile={executeTurnstile} />
            </>
          ) : (
            <>
              <Header
                title="Verify Your Email"
                description={
                  <p className="text-regular text-secondary">
                    We've sent an OTP code to <span className="break-all text-primary">{email}</span>.
                  </p>
                }
              >
                <Button variant="link-primary" onPress={() => setStep('EMAIL')} className="font-medium">
                  <ArrowLeftIcon className="size-4" />
                  <span className="text-leading font-medium">Back</span>
                </Button>
              </Header>

              <OtpStepForm email={email} executeTurnstile={executeTurnstile} />
            </>
          )}
        </div>

        {/* Bottom spacer for small height screens */}
        <div className="min-h-6 flex-1" />
      </div>

      <Footer>
        {step === 'EMAIL' ? (
          <>
            By clicking continue, you have read and agree to our{' '}
            <FooterLink href={LINKS.TERMS_OF_USE}>Terms of Use</FooterLink>, and{' '}
            <FooterLink href={LINKS.REG_S_COMPLIANCE}>Reg S Compliance Policy</FooterLink>.
          </>
        ) : (
          <>
            Need help? Contact us at{' '}
            <FooterLink variant="link-primary" href="mailto:investors@zivoe.com">
              investors@zivoe.com
            </FooterLink>
          </>
        )}
      </Footer>

      {WITH_TURNSTILE && (
        <div className="absolute bottom-0 right-0">
          <Turnstile
            options={{ execution: 'execute', appearance: 'execute' }}
            siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            onSuccess={(token) => turnstilePromiseRef.current?.resolve(token)}
            onError={(error) => turnstilePromiseRef.current?.reject(new Error(error))}
            onBeforeInteractive={() => toast({ type: 'warning', title: 'Verify you are human to continue' })}
            ref={turnstileRef}
          />
        </div>
      )}
    </>
  );
}

const emailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address')
});

type EmailFormData = z.infer<typeof emailSchema>;

function EmailStepForm({
  onSuccess,
  executeTurnstile
}: {
  onSuccess: (data: EmailFormData) => void;
  executeTurnstile: () => Promise<string>;
}) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isTwitterLoading, setIsTwitterLoading] = useState(false);

  const handleSocialSignIn = async ({ provider }: { provider: 'google' | 'twitter' }) => {
    if (provider === 'google') setIsGoogleLoading(true);
    else setIsTwitterLoading(true);

    const { err } = await handlePromise(
      authClient.signIn.social({
        provider,
        callbackURL: '/'
      })
    );

    if (err) {
      toast({
        title: 'Sign in failed',
        description: err instanceof Error ? err.message : undefined,
        type: 'error'
      });

      Sentry.captureException(err, { tags: { source: 'SERVER', flow: `${provider}-signin` } });
    }

    if (provider === 'google') setIsGoogleLoading(false);
    else setIsTwitterLoading(false);
  };

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
    mode: 'onSubmit'
  });

  const handleSubmit = async ({ email }: EmailFormData) => {
    let captchaHeaders: Record<string, string> = {};

    if (WITH_TURNSTILE) {
      const { res: token, err } = await handlePromise(executeTurnstile());

      if (!token || err) {
        toast({ type: 'error', title: 'Verification failed. Please try again.' });
        return;
      }

      captchaHeaders = { 'x-captcha-response': token };
    }

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
      fetchOptions: { headers: captchaHeaders }
    });

    if (error) {
      toast({
        title: 'Failed to send verification code',
        description: error.message,
        type: 'error'
      });

      Sentry.captureException(error, { tags: { source: 'SERVER', flow: 'send-otp' } });

      return;
    }

    onSuccess({ email });
  };

  return (
    <>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        <Controller
          control={form.control}
          name="email"
          render={({ field: { value, onChange, ...field }, fieldState: { error, invalid } }) => (
            <Input
              {...field}
              autoFocus
              label="Email"
              placeholder="Enter Your Email"
              type="email"
              value={value}
              onChange={onChange}
              isDisabled={form.formState.isSubmitting}
              isInvalid={invalid}
              errorMessage={error?.message}
            />
          )}
        />

        <Button
          type="submit"
          fullWidth
          isPending={form.formState.isSubmitting}
          isDisabled={isGoogleLoading || isTwitterLoading}
          pendingContent="Sending code..."
        >
          Continue
        </Button>
      </form>

      <Separator>Or</Separator>

      <div className="flex gap-6">
        <Button
          type="button"
          variant="border-light"
          fullWidth
          onPress={() => handleSocialSignIn({ provider: 'google' })}
          isPending={isGoogleLoading}
          isDisabled={form.formState.isSubmitting || isTwitterLoading}
          className="[&_svg]:!size-6"
        >
          <GoogleIcon />
        </Button>

        <Button
          type="button"
          variant="border-light"
          fullWidth
          onPress={() => handleSocialSignIn({ provider: 'twitter' })}
          isPending={isTwitterLoading}
          isDisabled={form.formState.isSubmitting || isGoogleLoading}
          className="[&_svg]:!size-6"
        >
          <TwitterIcon />
        </Button>
      </div>
    </>
  );
}

const OTP_LENGTH = 6;

const otpSchema = z.object({
  otp: z
    .string({ required_error: 'Verification code is required' })
    .length(OTP_LENGTH, 'Please enter the complete verification code')
});

type OtpFormData = z.infer<typeof otpSchema>;

function OtpStepForm({ email, executeTurnstile }: { email: string; executeTurnstile: () => Promise<string> }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { remainingSeconds, isOnCooldown, isExhausted, canResend, attemptsRemaining, startCooldown } =
    useOtpResendRateLimit();

  const form = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
    mode: 'onSubmit'
  });

  const handleVerifyOtp = async (otp: string) => {
    setIsLoading(true);

    const toastId = toast({
      title: 'Verifying code...',
      type: 'pending'
    });

    const { error } = await authClient.signIn.emailOtp({ email, otp });

    sonnerToast.dismiss(toastId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        type: 'error'
      });

      Sentry.captureException(error, { tags: { source: 'SERVER', flow: 'verify-otp' } });

      form.reset();
      setIsLoading(false);
      setTimeout(() => form.setFocus('otp'), 0);
      return;
    }

    router.push('/');
  };

  const handleResendCode = async () => {
    if (!canResend) return;

    setIsResending(true);
    form.clearErrors('otp');

    let captchaHeaders: Record<string, string> = {};

    if (WITH_TURNSTILE) {
      const { res: token, err } = await handlePromise(executeTurnstile());

      if (!token || err) {
        toast({ type: 'error', title: 'Verification failed. Please try again.' });
        setIsResending(false);
        return;
      }

      captchaHeaders = { 'x-captcha-response': token };
    }

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
      fetchOptions: { headers: captchaHeaders }
    });

    if (error) {
      toast({
        title: 'Failed to resend code',
        description: error.message,
        type: 'error'
      });

      Sentry.captureException(error, { tags: { source: 'SERVER', flow: 'resend-otp' } });
    } else {
      toast({
        title: 'Code sent',
        description: 'A new verification code has been sent to your email',
        type: 'success'
      });

      form.reset();
      startCooldown();
    }

    setIsResending(false);
  };

  return (
    <div className="flex flex-col gap-11">
      <Controller
        control={form.control}
        name="otp"
        render={({ field: { value, onChange, ref }, fieldState: { error } }) => (
          <div className="flex flex-col gap-2">
            <InputOTP
              autoFocus
              ref={ref}
              maxLength={OTP_LENGTH}
              pattern={REGEXP_ONLY_DIGITS}
              value={value}
              onChange={onChange}
              onComplete={handleVerifyOtp}
              disabled={isLoading || isResending}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>

            {error && <p className="text-small text-alert">{error.message}</p>}
          </div>
        )}
      />

      {!isExhausted && (
        <div className="flex items-center gap-1 text-regular text-secondary">
          <span>Didn&apos;t receive an email?</span>
          <Button variant="link-primary" size="m" onPress={handleResendCode} isDisabled={isLoading || !canResend}>
            {isResending
              ? 'Resending code...'
              : isOnCooldown
                ? `Resend code (${remainingSeconds}s)`
                : attemptsRemaining < 3
                  ? `Resend code (${attemptsRemaining} left)`
                  : 'Resend code'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Header({
  title,
  description,
  children
}: {
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-11">
      {children}

      <div className="flex flex-col gap-4">
        <h1 className="text-h5 text-neutral-900">{title}</h1>
        {description}
      </div>
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center py-5">
      <p className="max-w-[28rem] text-center text-small text-tertiary">{children}</p>
    </div>
  );
}

function FooterLink({
  variant = 'link-tertiary',
  href,
  children
}: {
  variant?: LinkProps['variant'];
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      hideExternalLinkIcon
      variant={variant}
      size="s"
      className="hover:underline-offset-4"
    >
      {children}
    </Link>
  );
}
