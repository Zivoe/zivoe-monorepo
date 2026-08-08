import { formatUnits } from 'viem';

import { Button } from '@zivoe/ui/core/button';

interface MaxButtonProps {
  balance: bigint;
  decimals: number;
  onPress: (maxAmount: string) => void;
  isDisabled: boolean;
}

export function MaxButton({ balance, decimals, onPress, isDisabled }: MaxButtonProps) {
  const hasBalance = balance > 0n;
  if (!hasBalance) return null;

  const handleMaxClick = () => {
    const maxAmount = formatUnits(balance, decimals);
    onPress(maxAmount);
  };

  return (
    <div className="hidden items-center border-r border-default px-3 sm:flex">
      <Button variant="border-light" size="s" isDisabled={isDisabled} onPress={handleMaxClick}>
        Max
      </Button>
    </div>
  );
}
