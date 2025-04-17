'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';

import { handlePromise } from '@/lib/utils';

import { joinNewsletter } from './join-newsletter';

const newsletterFormSchema = z.object({
  email: z.string().min(1, 'Email is required').email({ message: 'Invalid email address' })
});

type NewsletterFormSchema = z.infer<typeof newsletterFormSchema>;

export default function Newsletter() {
  const joinNewsletter = useJoinNewsletter();

  const form = useForm<NewsletterFormSchema>({
    resolver: zodResolver(newsletterFormSchema),
    defaultValues: { email: '' },
    mode: 'onBlur'
  });

  const handleSubmit = (data: NewsletterFormSchema) => {
    joinNewsletter.mutate(data);
  };

  return (
    <form className="flex gap-2" onSubmit={form.handleSubmit(handleSubmit)}>
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
            className="w-full sm:w-[17.5rem]"
            {...field}
          />
        )}
      />

      <Button type="submit" isPending={joinNewsletter.isPending}>
        Sign up
      </Button>
    </form>
  );
}

const useJoinNewsletter = () => {
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { res, err } = await handlePromise(joinNewsletter({ email }));

      if (err || !res) throw new Error('Error joining newsletter, please try again');
      if (res.error || !res.message) throw new Error(res.error);

      return { message: res.message };
    },

    onSuccess: ({ message }) => toast.success(message),
    onError: (error) => toast.error(error.message)
  });
};
