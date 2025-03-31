import { type ClassNameValue, extendTailwindMerge } from 'tailwind-merge';
import { TV, VariantProps, tv as tvBase } from 'tailwind-variants';

const twMergeConfig = {
  classGroups: {
    'font-size': [
      {
        text: [
          'tiny',
          'extraSmall',
          'small',
          'regular',
          'leading',
          'smallSubheading',
          'subheading',
          'h7',
          'h6',
          'h5',
          'h4',
          'h3',
          'h2',
          'h1',
          'medium',
          'large',
          'extraLarge'
        ]
      }
    ],

    'text-color': [
      {
        text: [
          'primary',
          'secondary',
          'tertiary',
          'disabled',
          'brand',
          'brand-subtle',
          'brand-light',
          'brand-secondary',
          'brand-secondary-subtle',
          'success',
          'success-subtle',
          'warning',
          'warning-subtle',
          'alert',
          'alert-subtle',
          'base'
        ]
      }
    ]
  }
};

const twMerge = extendTailwindMerge({
  extend: twMergeConfig
});

export const cn = (...inputs: Array<ClassNameValue>) => twMerge(inputs);

export const tv: TV = (options, config) =>
  tvBase(options, {
    ...config,
    twMergeConfig: {
      ...config?.twMergeConfig,
      classGroups: {
        ...config?.twMergeConfig?.classGroups,
        ...twMergeConfig.classGroups
      }
    }
  });

export type { VariantProps };
