'use client';

import { type Dispatch } from 'react';

import { Button } from '@zivoe/ui/core/button';
import { DialogContentBox } from '@zivoe/ui/core/dialog';
import { Input } from '@zivoe/ui/core/input';
import { Tab, TabList, TabPanel, Tabs } from '@zivoe/ui/core/tabs';
import { CheckCircleIcon, Spinner, UsdcIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { PERENA_DEMO_NOTICE } from './config';
import { AlternativeCreditLogo } from './logo';
import { type DemoAction, type DemoState, type DemoTab, amountError, formatDemoAmount, parseDemoAmount } from './state';

export function TransactionPanel({
  state,
  dispatch,
  ready,
  onTabChange,
  withTitle = true
}: {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  ready: boolean;
  onTabChange: (tab: DemoTab) => void;
  withTitle?: boolean;
}) {
  const isDeposit = state.tab === 'deposit';
  const balance = isDeposit ? state.usdc : state.shares;
  const error = amountError(state.input, balance);
  const tx = state.transaction;
  const editing = state.stage === 'edit';
  const amount = parseDemoAmount(state.input);
  const estimatedReceive = amount !== null && amount > 0n ? formatDemoAmount(amount, false) : '';
  const receiveBalance = isDeposit ? state.shares : state.usdc;

  return (
    <div className={cn('rounded-2xl bg-surface-elevated', withTitle && 'p-2')}>
      {withTitle && (
        <div className="p-4">
          <h2 className="text-h6 text-primary">Earn</h2>
        </div>
      )}
      <DialogContentBox className={cn(!withTitle && 'p-4')}>
        <Tabs selectedKey={state.tab} onSelectionChange={(key) => onTabChange(key as DemoTab)}>
          <TabList aria-label="Demo transaction">
            <Tab id="deposit" isDisabled={state.stage === 'processing'}>
              Deposit
            </Tab>
            <Tab id="redeem" isDisabled={state.stage === 'processing'}>
              Redeem
            </Tab>
          </TabList>
          <TabPanel id={state.tab}>
            {editing ? (
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!ready) return;
                  if (!state.connected) dispatch({ type: 'connect' });
                  else dispatch({ type: 'review', id: crypto.randomUUID(), at: new Date().toISOString() });
                }}
              >
                <div className="flex flex-col gap-2">
                  <Input
                    label={isDeposit ? 'USDC amount' : 'Shares to redeem'}
                    placeholder="0.00"
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={30}
                    value={state.input}
                    onChange={(value) => dispatch({ type: 'input', value })}
                    groupClassName="h-24 bg-surface-base pr-4 pl-4 text-h6 sm:pl-6"
                    inputClassName="bg-surface-base text-h6 placeholder:text-h6"
                    endContent={<DemoAsset shares={!isDeposit} />}
                    isInvalid={!!state.input && !!error}
                    errorMessage={state.input ? error : undefined}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-small text-secondary">
                    <span>
                      Available: {ready ? formatDemoAmount(balance) : '—'} {isDeposit ? 'USDC' : 'shares'}
                    </span>
                    <Button
                      size="xs"
                      variant="primary-light"
                      isDisabled={!ready}
                      onPress={() => dispatch({ type: 'input', value: formatDemoAmount(balance, false) })}
                    >
                      Max
                    </Button>
                  </div>
                </div>
                <Input
                  variant="amount"
                  label="Estimated receive"
                  placeholder="0.00"
                  value={estimatedReceive}
                  isReadOnly
                  groupClassName="pr-4 pl-4 sm:pl-6"
                  endContent={<DemoAsset shares={isDeposit} />}
                  subContent={
                    <p className="text-small text-secondary">
                      Balance: {ready ? formatDemoAmount(receiveBalance) : '—'} {isDeposit ? 'shares' : 'USDC'}
                    </p>
                  }
                />
                <Button type="submit" fullWidth isDisabled={!ready || (state.connected && !!error)}>
                  {!ready
                    ? 'Restoring demo…'
                    : !state.connected
                      ? 'Use demo wallet'
                      : `Review ${isDeposit ? 'deposit' : 'redemption'}`}
                </Button>
                <p className="text-small text-secondary">
                  {state.connected ? 'Demo wallet connected.' : 'Start with 1,000 demo USDC.'} $1.00 per share · No
                  simulated fees.
                </p>
              </form>
            ) : tx ? (
              <div className="flex flex-col gap-5" aria-live="polite" aria-atomic="true">
                {state.stage === 'review' ? (
                  <>
                    <h3 className="text-h6 text-primary">Review {tx.kind === 'deposit' ? 'deposit' : 'redemption'}</h3>
                    <dl className="rounded-xl bg-surface-elevated p-4">
                      <Detail
                        label={tx.kind === 'deposit' ? 'You deposit' : 'You redeem'}
                        value={`${formatDemoAmount(tx.amount)} ${tx.kind === 'deposit' ? 'USDC' : 'shares'}`}
                      />
                      <Detail
                        label="You receive"
                        value={`${formatDemoAmount(tx.amount)} ${tx.kind === 'deposit' ? 'shares' : 'USDC'}`}
                      />
                      <Detail label="Simulated fees" value="$0.00" />
                    </dl>
                    <p className="text-small text-secondary">
                      This updates only your demo balances. No funds will move.
                    </p>
                    <Button fullWidth onPress={() => dispatch({ type: 'confirm' })}>
                      Simulate transaction
                    </Button>
                    <Button fullWidth variant="border-light" onPress={() => dispatch({ type: 'cancel' })}>
                      Cancel
                    </Button>
                  </>
                ) : state.stage === 'processing' ? (
                  <div className="flex flex-col items-center gap-4 py-10 text-center" role="status">
                    <Spinner className="size-10 animate-spin text-brand" />
                    <h3 className="text-h6 text-primary">Simulating transaction…</h3>
                    <p className="text-small text-secondary">Updating your local demo balances.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-4 text-center" role="status">
                    <CheckCircleIcon className="size-12 text-brand" />
                    <h3 className="text-h6 text-primary">
                      {tx.kind === 'deposit' ? 'Deposit' : 'Redemption'} simulated
                    </h3>
                    <p className="text-regular text-secondary">
                      {formatDemoAmount(tx.amount)} {tx.kind === 'deposit' ? 'shares added to' : 'USDC returned to'}{' '}
                      your demo wallet.
                    </p>
                    <Button fullWidth onPress={() => dispatch({ type: 'done' })}>
                      Done
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </TabPanel>
        </Tabs>
        <p className="text-small text-tertiary">{PERENA_DEMO_NOTICE}</p>
      </DialogContentBox>
      <div className="flex flex-col gap-3 px-4 pt-4 pb-2">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 min-[390px]:grid-cols-3" aria-label="Demo balances">
          <Position label="Wallet USDC" value={ready ? formatDemoAmount(state.usdc) : '—'} />
          <Position label="Vault shares" value={ready ? formatDemoAmount(state.shares) : '—'} />
          <Position label="Position value" value={ready ? `$${formatDemoAmount(state.shares)}` : '—'} />
        </dl>
        <Button
          variant="link-neutral-dark"
          size="s"
          className="self-end"
          isDisabled={!ready || state.stage === 'processing'}
          onPress={() => dispatch({ type: 'reset' })}
        >
          Reset demo
        </Button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-small">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-right text-primary">{value}</dd>
    </div>
  );
}

function DemoAsset({ shares }: { shares: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-2 text-small text-primary">
      {shares ? <AlternativeCreditLogo className="size-4" /> : <UsdcIcon aria-hidden="true" />}
      <span className="flex flex-col text-left">
        <span className="font-medium">{shares ? 'Vault shares' : 'USDC'}</span>
        <span className="text-extraSmall text-tertiary">Solana</span>
      </span>
    </span>
  );
}

function Position({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-extraSmall text-secondary">{label}</dt>
      <dd className="mt-1 text-small font-medium break-all text-primary">{value}</dd>
    </div>
  );
}
