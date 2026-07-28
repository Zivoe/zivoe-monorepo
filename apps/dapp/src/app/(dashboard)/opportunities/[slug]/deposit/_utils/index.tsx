import { parseUnits } from 'viem';
import { z } from 'zod';

export const depositPageTabSchema = z.enum(['deposit', 'redeem']);
export const depositPageViewSchema = depositPageTabSchema.nullable();
export type DepositPageTab = z.infer<typeof depositPageTabSchema>;
export type DepositPageView = z.infer<typeof depositPageViewSchema>;

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
