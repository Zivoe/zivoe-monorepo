'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Popover } from 'react-aria-components';

import { InfoIcon } from '@zivoe/ui/icons';

/** A hoverable disclosure that also opens on keyboard focus and touch. */
export function MetricHelp({ label, children }: { label: string; children: React.ReactNode }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const keyboardFocused = useRef(false);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const cancelClose = () => clearTimeout(closeTimer.current);
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    if (!pinned && !keyboardFocused.current) closeTimer.current = setTimeout(() => setOpen(false), 200);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    // Hover does not move focus into the overlay, so Escape must also work
    // when focus is elsewhere on the page.
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      clearTimeout(closeTimer.current);
      setOpen(false);
      setPinned(false);
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        className="-my-2 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-primary/65 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-900"
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) {
            keyboardFocused.current = true;
            show();
          }
        }}
        onBlur={() => {
          keyboardFocused.current = false;
          scheduleClose();
        }}
        onClick={() => {
          cancelClose();
          setPinned(!pinned);
          setOpen(!pinned);
        }}
      >
        <InfoIcon aria-hidden="true" className="size-4" />
      </button>
      <Popover
        triggerRef={trigger}
        isOpen={open}
        onOpenChange={(value) => {
          cancelClose();
          setOpen(value);
          if (!value) setPinned(false);
        }}
        isNonModal
        shouldCloseOnInteractOutside={(element) => !trigger.current?.contains(element)}
        placement="bottom"
        offset={8}
        containerPadding={16}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        className="z-50 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-primary-900/20 bg-surface-base p-4 text-small leading-relaxed text-primary shadow-lg outline-hidden"
      >
        <div id={id} role="tooltip" className="flex flex-col gap-3">
          {children}
        </div>
      </Popover>
    </>
  );
}
