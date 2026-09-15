// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { afterEach, describe, expect, it } from 'vitest';

import { useIsAnyWritePending, useReportPendingWrite } from './pending-writes';

/** A control that reports its own write and reads whether any write is pending — the strips' and the form's contract. */
function Writer({ id, isPending }: { id: string; isPending: boolean }) {
  useReportPendingWrite(id, isPending);
  return <span>{`${id}: ${useIsAnyWritePending() ? 'wait' : 'free'}`}</span>;
}

function Reader() {
  return <span>{`reader: ${useIsAnyWritePending() ? 'wait' : 'free'}`}</span>;
}

afterEach(cleanup);

describe('pending writes', () => {
  it('locks every reader while one write is pending, and frees them when it settles', () => {
    const { rerender } = render(
      <JotaiProvider>
        <Writer id="claim" isPending={false} />
        <Reader />
      </JotaiProvider>
    );
    expect(screen.getByText('reader: free')).toBeTruthy();

    rerender(
      <JotaiProvider>
        <Writer id="claim" isPending={true} />
        <Reader />
      </JotaiProvider>
    );
    expect(screen.getByText('reader: wait')).toBeTruthy();
    expect(screen.getByText('claim: wait')).toBeTruthy();

    rerender(
      <JotaiProvider>
        <Writer id="claim" isPending={false} />
        <Reader />
      </JotaiProvider>
    );
    expect(screen.getByText('reader: free')).toBeTruthy();
  });

  it('releases a write whose component unmounts mid-flight — the signer lock is the backstop past that point', () => {
    const { rerender } = render(
      <JotaiProvider>
        <Writer id="claim" isPending={true} />
        <Reader />
      </JotaiProvider>
    );
    expect(screen.getByText('reader: wait')).toBeTruthy();

    rerender(
      <JotaiProvider>
        <Reader />
      </JotaiProvider>
    );
    expect(screen.getByText('reader: free')).toBeTruthy();
  });
});
