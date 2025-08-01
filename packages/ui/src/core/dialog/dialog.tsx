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

interface DialogProps extends React.ComponentProps<typeof Aria.DialogTrigger> {}
const Dialog = Aria.DialogTrigger;
const Modal = Aria.Modal;
type DialogContentProps = Omit<React.ComponentProps<typeof Aria.Modal>, 'children' | 'isDismissable'> & {
  children?: Aria.DialogProps['children'];
  role?: Aria.DialogProps['role'];
  logoType?: 'dark' | 'light';
  dialogClassName?: string;
  showCloseButton?: boolean;
} & ({ isDismissable: false; isFullScreen?: never } | { isDismissable?: true; isFullScreen?: boolean });

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  (
    {
      className,
      dialogClassName,
      children,
      isDismissable = true,
      showCloseButton = true,
      isFullScreen = false,
      role,
      logoType = 'dark',
      ...props
    }: DialogContentProps,
    ref
  ) => (
    <Aria.ModalOverlay
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable}
      className={cn(
        'fixed inset-0 z-50 grid w-screen place-items-center items-center bg-surface-contrast/40 backdrop-blur-[4px]',
        !isFullScreen && 'px-2 py-6',
        /* Entering */
        'data-[entering]:animate-in data-[entering]:fade-in-0',
        /* Exiting */
        'data-[exiting]:duration-300 data-[exiting]:animate-out data-[exiting]:fade-out-0',
        'h-[var(--visual-viewport-height)]'
      )}
    >
      <Aria.Modal
        className={composeRenderProps(className, (className) =>
          cn(
            nativeScrollAreaStyles(),
            'relative z-50 w-full overflow-auto bg-surface-elevated p-2 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]',
            isFullScreen ? 'h-full' : 'max-h-full max-w-[33.75rem] rounded-2xl',
            /* Entering */
            'data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-75',
            /* Exiting */
            'data-[exiting]:duration-300 data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-75',
            className
          )
        )}
        {...props}
      >
        <Aria.Dialog
          className={cn('flex flex-col items-center gap-4 outline-none', isFullScreen && 'h-full')}
          ref={ref}
        >
          {composeRenderProps(children, (children, { close }) => (
            <>
              {isFullScreen ? (
                <div className="flex w-full items-center justify-between gap-6">
                  <ZivoeLogo type={logoType} />

                  <Button size="m" variant="border-light" onPress={close} className="z-10">
                    <CloseIcon />
                  </Button>
                </div>
              ) : (
                isDismissable &&
                showCloseButton && (
                  <Button size="m" variant="border-light" onPress={close} className="absolute right-4 top-4">
                    <CloseIcon />
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
        'flex flex-col gap-4 rounded-2xl bg-surface-base p-6 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]',
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
