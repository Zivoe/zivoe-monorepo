'use client';

import React from 'react';

import { Toaster as Sonner, toast as sonnerToast } from 'sonner';

import { CheckCircleIcon, CloseCircleIcon, Spinner, WarningIcon } from '../../icons';
import { VariantProps, cn, tv } from '../../lib/tw-utils';

function Toaster({ ...props }: React.ComponentProps<typeof Sonner>) {
  return <Sonner theme="light" position="top-right" {...props} />;
}

export type ToastProps = {
  id: string | number;
  type?: IconVariant['variant'];
  title: string;
  description?: string;
  duration?: number;
  dismissible?: boolean;
};

function toast(toast: Omit<ToastProps, 'id'>) {
  const isPendingToast = toast.type === 'pending';
  const duration = toast.duration ?? (isPendingToast ? Infinity : 5000);
  const dismissible = toast.dismissible ?? !isPendingToast;

  return sonnerToast.custom(
    (id) => <Toast id={id} type={toast.type} title={toast.title} description={toast.description} />,
    { duration, dismissible }
  );
}

const iconVariants = tv({
  base: ['flex min-h-8 min-w-8 items-center justify-center rounded-md [&_svg]:size-4'],

  variants: {
    variant: {
      success: 'bg-element-primary-gentle text-primary',
      warning: 'bg-element-warning-gentle text-warning',
      error: 'bg-element-alert-light text-alert',
      pending: 'bg-element-neutral text-neutral-600'
    }
  },

  defaultVariants: {
    variant: 'success'
  }
});

type IconVariant = VariantProps<typeof iconVariants>;

function Toast(props: ToastProps) {
  const { type = 'success', title, description } = props;

  return (
    <div
      className={cn(
        'flex w-full gap-3 rounded-md border border-subtle bg-surface-base p-5 shadow-lg md:w-[22.1rem]',
        description ? 'items-start' : 'items-center'
      )}
    >
      <div className={iconVariants({ variant: type })}>{TOAST_ICON[type]}</div>

      <div className="flex flex-col gap-1">
        <p className="text-leading text-primary">{title}</p>
        {description && <p className="text-small text-secondary">{description}</p>}
      </div>
    </div>
  );
}

const TOAST_ICON: Record<Exclude<IconVariant['variant'], undefined>, React.ReactNode> = {
  success: <CheckCircleIcon />,
  error: <CloseCircleIcon />,
  pending: <Spinner className="animate-spin" />,
  warning: <WarningIcon />
};

export { Toaster, toast, iconVariants };
