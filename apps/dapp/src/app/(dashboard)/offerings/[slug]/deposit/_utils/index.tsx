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
  exceedsMessage,
  max
}: {
  balance: bigint;
  decimals: number;
  requiredMessage: string;
  exceedsMessage: string;
  /** Optional cap above the balance rule (e.g. vault capacity); skipped while its value is unknown. */
  max?: { value: bigint | undefined; message: string };
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

    if (max?.value !== undefined && parsedAmount > max.value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: max.message
      });
    }
  });
};

export const parseInput = (value: string) => {
  if (value.startsWith('.')) value = '0' + value;

  // Remove leading zeros
  return value.replace(/^0+(?=\d)/, '');
};
