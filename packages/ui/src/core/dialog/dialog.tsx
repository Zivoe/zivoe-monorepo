'use client';

import * as React from 'react';
import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';

import { ZivoeLogo } from '../../assets/zivoe-logo';
import { CloseIcon } from '../../icons';
import { cn } from '../../lib/tw-utils';
import { Button } from '../button';
import { nativeScrollAreaStyles } from '../native-scroll-area';

type DialogProps = React.ComponentProps<typeof Aria.DialogTrigger>;
const Dialog = Aria.DialogTrigger;
const Modal = Aria.Modal;
type DialogContentProps = Omit<React.ComponentProps<typeof Aria.Modal>, 'children' | 'isDismissable'> & {
  children?: Aria.DialogProps['children'];
  role?: Aria.DialogProps['role'];
  'aria-label'?: Aria.DialogProps['aria-label'];
  'aria-labelledby'?: Aria.DialogProps['aria-labelledby'];
  'aria-describedby'?: Aria.DialogProps['aria-describedby'];
  logoType?: 'dark' | 'light';
  dialogClassName?: string;
  showCloseButton?: boolean;
  showFullScreenHeader?: boolean;
  isDismissable?: boolean;
  isFullScreen?: boolean;
};

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  (
    {
      className,
      dialogClassName,
      children,
      isDismissable = true,
      showCloseButton = true,
      isFullScreen = false,
      showFullScreenHeader = true,
      role,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      logoType = 'dark',
      ...props
    }: DialogContentProps,
    ref
  ) => (
    <Aria.ModalOverlay
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable}
      className={cn(
        'bg-surface-contrast/40 fixed inset-0 z-50 grid w-screen place-items-center items-center backdrop-blur-xs',
        !isFullScreen && 'px-2 py-6',
        /* Entering */
        'entering:animate-in entering:fade-in-0',
        /* Exiting */
        'exiting:animate-out exiting:fade-out-0 exiting:duration-300',
        'h-(--visual-viewport-height)'
      )}
    >
      <Aria.Modal
        className={composeRenderProps(className, (className) =>
          cn(
            nativeScrollAreaStyles(),
            'bg-surface-elevated relative z-50 w-full overflow-auto p-2 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]',
            isFullScreen ? 'h-full' : 'max-h-full max-w-135 rounded-2xl',
            /* Entering */
            'data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-75',
            /* Exiting */
            'data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-75 data-exiting:duration-300',
            className
          )
        )}
        {...props}
      >
        <Aria.Dialog
          role={role}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          className={cn('flex flex-col items-center gap-4 outline-hidden', isFullScreen && 'h-full')}
          ref={ref}
        >
          {composeRenderProps(children, (children, { close }) => (
            <>
              {isFullScreen && showFullScreenHeader ? (
                <div className="flex w-full items-center justify-between gap-6">
                  <ZivoeLogo type={logoType} />

                  <Button aria-label="Close dialog" size="m" variant="border-light" onPress={close} className="z-10">
                    <CloseIcon aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                isDismissable &&
                showCloseButton && (
                  <Button
                    aria-label="Close dialog"
                    size="m"
                    variant="border-light"
                    onPress={close}
                    className="absolute top-4 right-4"
                  >
                    <CloseIcon aria-hidden="true" />
                  </Button>
                )
              )}

              <div
                className={cn(
                  'flex h-full w-full flex-col',
                  isFullScreen ? 'w-[min(100%,30.75rem)] gap-11' : 'w-full gap-4',
                  dialogClassName
                )}
              >
                {children}
              </div>
            </>
          ))}
        </Aria.Dialog>
      </Aria.Modal>
    </Aria.ModalOverlay>
  )
);

const DialogContentBox = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        'bg-surface-base flex flex-col gap-4 rounded-2xl p-6 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2 p-4', className)} {...props} />
);

const DialogTitle = ({ className, ...props }: Aria.HeadingProps) => (
  <Aria.Heading slot="title" className={cn('text-h6 text-primary', className)} {...props} />
);

const DialogFooter = ({ className, ...props }: { className?: string; children: React.ReactNode }) => {
  return <div className={cn('flex w-full justify-end gap-4', className)} {...props} />;
};

DialogContent.displayName = 'ZivoeUI.DialogContent';
DialogHeader.displayName = 'ZivoeUI.DialogHeader';
DialogTitle.displayName = 'ZivoeUI.DialogTitle';
DialogFooter.displayName = 'ZivoeUI.DialogFooter';

export { Dialog, Modal, DialogContent, DialogContentBox, DialogHeader, DialogTitle, DialogFooter };

export type { DialogProps, DialogContentProps };
