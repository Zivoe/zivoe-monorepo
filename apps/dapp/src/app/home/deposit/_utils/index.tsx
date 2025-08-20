import { parseUnits } from 'viem';
import { z } from 'zod';

export const depositPageViewSchema = z.enum(['deposit', 'redeem']);
export type DepositPageView = z.infer<typeof depositPageViewSchema> | null;

export const createAmountValidator = ({
  balance,
  decimals,
  requiredMessage,
  exceedsMessage
}: {
  balance: bigint;
  decimals: number;
  requiredMessage: string;
  exceedsMessage: string;
}) => {
  return z.string({ required_error: requiredMessage }).superRefine((amount, ctx) => {
    const parsedAmount = parseUnits(amount, decimals);

    if (parsedAmount === 0n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: requiredMessage
      });
    }

    if (parsedAmount > balance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: exceedsMessage
      });
    }
  });
};

export const parseInput = (value: string) => {
  if (value.startsWith('.')) value = '0' + value;

  // Remove leading zeros
  return value.replace(/^0+(?=\d)/, '');
};

export const calculateZVLTDollarValue = ({
  amount,
  indexPrice
}: {
  amount: string | undefined;
  indexPrice: number | null;
}): bigint | null => {
  if (!indexPrice) return null;
  if (!amount) return 0n;

  return (parseUnits(amount, 18) * parseUnits(indexPrice.toFixed(6), 18)) / 10n ** 18n;
};
