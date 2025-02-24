import { type ClassNameValue, twMerge } from 'tailwind-merge';
import { VariantProps, tv as tvBase } from 'tailwind-variants';

export const cn = (...inputs: Array<ClassNameValue>) => twMerge(inputs);
export const tv = tvBase;

export type { VariantProps };
