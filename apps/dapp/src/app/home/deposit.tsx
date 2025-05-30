'use client';

import { ReactNode, useState } from 'react';

import { Button, ButtonProps } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger } from '@zivoe/ui/core/select';
import { UsdtIcon, ZsttIcon } from '@zivoe/ui/icons';
import { UsdcIcon } from '@zivoe/ui/icons';
import { FraxIcon } from '@zivoe/ui/icons/frax';

import { DEPOSIT_TOKENS, DEPOSIT_TOKEN_DECIMALS, DepositToken } from '@/types/constants';

import { formatBigIntToReadable } from '@/lib/utils';

import { useDepositBalances } from '@/hooks/useDepositBalances';

import ConnectedAccount from '@/components/connected-account';

import { SelectValue } from '../../../../../packages/ui/src/core/select/select';

export default function Deposit() {
  const [depositToken, setDepositToken] = useState<DepositToken>('USDC');
  const [deposit, setDeposit] = useState('');
  const [receive, setReceive] = useState('');

  const depositBalances = useDepositBalances();
  const hasDepositBalance = !!depositBalances.data && depositBalances.data[depositToken] > 0n;

  const isFetching = depositBalances.isFetching;

  return (
    <div className="sticky top-14 hidden rounded-2xl bg-surface-elevated p-2 lg:block lg:min-w-[24.75rem] xl:min-w-[39.375rem]">
      <div className="p-4">
        <p className="text-h6 text-primary">Deposit & Earn</p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-surface-base p-6 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]">
        <Input
          variant="amount"
          label="Deposit"
          labelContent={<DepositTokenBalance token={depositToken} />}
          labelClassName="h-5"
          value={deposit}
          onChange={(value) => setDeposit(value)}
          isDisabled={isFetching}
          decimalPlaces={DEPOSIT_TOKEN_DECIMALS[depositToken]}
          endContent={
            <div className="flex items-center">
              {hasDepositBalance && <DepositMaxButton isDisabled={isFetching} />}

              <div className="ml-3">
                <DepositTokenSelect
                  isDisabled={isFetching}
                  selected={depositToken}
                  onSelectionChange={setDepositToken}
                />
              </div>
            </div>
          }
        />

        <Input
          variant="amount"
          label="Receive"
          labelContent={<p className="text-small text-primary">Balance: 1234.56</p>}
          value={receive}
          onChange={(value) => setReceive(value)}
          isDisabled={isFetching}
          decimalPlaces={18}
        />

        <ConnectedAccount>
          <Button fullWidth isPending={isFetching} pendingContent="Loading...">
            Deposit
          </Button>
        </ConnectedAccount>
      </div>
    </div>
  );
}

function DepositTokenBalance({ token }: { token: DepositToken }) {
  const depositBalances = useDepositBalances();
  if (depositBalances.isPending || !depositBalances.data) return null;

  return (
    <p className="text-small text-primary">
      Balance: {formatBigIntToReadable(depositBalances.data[token], DEPOSIT_TOKEN_DECIMALS[token])}
    </p>
  );
}

const DEPOSIT_TOKEN_ICON: Record<DepositToken, ReactNode> = {
  USDC: <UsdcIcon />,
  USDT: <UsdtIcon />,
  FRX: <FraxIcon />,
  zSTT: <ZsttIcon />
};

const DEPOSIT_TOKENS_SELECT_ITEMS = DEPOSIT_TOKENS.map((token, index) => ({
  id: token,
  label: token,
  icon: DEPOSIT_TOKEN_ICON[token]
}));

function DepositMaxButton(props: ButtonProps) {
  return (
    <div className="border-r border-default px-3">
      <Button variant="border-light" size="s" {...props}>
        Max
      </Button>
    </div>
  );
}

function DepositTokenSelect({
  selected,
  onSelectionChange,
  isDisabled
}: {
  selected: DepositToken;
  isDisabled: boolean;
  onSelectionChange: (value: DepositToken) => void;
}) {
  return (
    <Select
      placeholder="Select"
      aria-label="Select a chart view"
      selectedKey={selected}
      onSelectionChange={(value) => onSelectionChange(value as DepositToken)}
      isDisabled={isDisabled}
    >
      <SelectTrigger>
        <SelectValue className="flex items-center gap-2 [&_svg]:size-6" />
      </SelectTrigger>

      <SelectPopover>
        <SelectListBox items={DEPOSIT_TOKENS_SELECT_ITEMS}>
          {(item) => (
            <SelectItem key={item.id} className="flex items-center gap-2 [&_svg]:size-5">
              {item.icon}
              {item.label}
            </SelectItem>
          )}
        </SelectListBox>
      </SelectPopover>
    </Select>
  );
}
