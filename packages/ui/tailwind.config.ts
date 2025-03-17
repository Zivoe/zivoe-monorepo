import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/core/**/*.{ts,tsx}'],

  theme: {
    colors: {
      neutral: {
        0: 'hsl(var(--neutral-0))',
        50: 'hsl(var(--neutral-50))',
        100: 'hsl(var(--neutral-100))',
        200: 'hsl(var(--neutral-200))',
        300: 'hsl(var(--neutral-300))',
        400: 'hsl(var(--neutral-400))',
        500: 'hsl(var(--neutral-500))',
        600: 'hsl(var(--neutral-600))',
        700: 'hsl(var(--neutral-700))',
        800: 'hsl(var(--neutral-800))',
        900: 'hsl(var(--neutral-900))',
        950: 'hsl(var(--neutral-950))'
      },

      primary: {
        50: 'hsl(var(--primary-50))',
        100: 'hsl(var(--primary-100))',
        200: 'hsl(var(--primary-200))',
        300: 'hsl(var(--primary-300))',
        400: 'hsl(var(--primary-400))',
        500: 'hsl(var(--primary-500))',
        600: 'hsl(var(--primary-600))',
        700: 'hsl(var(--primary-700))',
        800: 'hsl(var(--primary-800))',
        900: 'hsl(var(--primary-900))',
        950: 'hsl(var(--primary-950))'
      },

      secondary: {
        50: 'hsl(var(--secondary-50))',
        100: 'hsl(var(--secondary-100))',
        200: 'hsl(var(--secondary-200))',
        300: 'hsl(var(--secondary-300))',
        400: 'hsl(var(--secondary-400))',
        500: 'hsl(var(--secondary-500))',
        600: 'hsl(var(--secondary-600))',
        700: 'hsl(var(--secondary-700))',
        800: 'hsl(var(--secondary-800))',
        900: 'hsl(var(--secondary-900))',
        950: 'hsl(var(--secondary-950))'
      },

      tertiary: {
        50: 'hsl(var(--tertiary-50))',
        100: 'hsl(var(--tertiary-100))',
        200: 'hsl(var(--tertiary-200))',
        300: 'hsl(var(--tertiary-300))',
        400: 'hsl(var(--tertiary-400))',
        500: 'hsl(var(--tertiary-500))',
        600: 'hsl(var(--tertiary-600))',
        700: 'hsl(var(--tertiary-700))',
        800: 'hsl(var(--tertiary-800))',
        900: 'hsl(var(--tertiary-900))',
        950: 'hsl(var(--tertiary-950))'
      },

      success: {
        50: 'hsl(var(--success-50))',
        100: 'hsl(var(--success-100))',
        200: 'hsl(var(--success-200))',
        300: 'hsl(var(--success-300))',
        400: 'hsl(var(--success-400))',
        500: 'hsl(var(--success-500))',
        600: 'hsl(var(--success-600))',
        700: 'hsl(var(--success-700))',
        800: 'hsl(var(--success-800))',
        900: 'hsl(var(--success-900))',
        950: 'hsl(var(--success-950))'
      },

      warning: {
        50: 'hsl(var(--warning-50))',
        100: 'hsl(var(--warning-100))',
        200: 'hsl(var(--warning-200))',
        300: 'hsl(var(--warning-300))',
        400: 'hsl(var(--warning-400))',
        500: 'hsl(var(--warning-500))',
        600: 'hsl(var(--warning-600))',
        700: 'hsl(var(--warning-700))',
        800: 'hsl(var(--warning-800))',
        900: 'hsl(var(--warning-900))',
        950: 'hsl(var(--warning-950))'
      },

      alert: {
        50: 'hsl(var(--alert-50))',
        100: 'hsl(var(--alert-100))',
        200: 'hsl(var(--alert-200))',
        300: 'hsl(var(--alert-300))',
        400: 'hsl(var(--alert-400))',
        500: 'hsl(var(--alert-500))',
        600: 'hsl(var(--alert-600))',
        700: 'hsl(var(--alert-700))',
        800: 'hsl(var(--alert-800))',
        900: 'hsl(var(--alert-900))',
        950: 'hsl(var(--alert-950))'
      }
    }
  }
};

export default config;
