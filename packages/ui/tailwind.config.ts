import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./src/core/**/*.{ts,tsx}'],

  theme: {
    fontSize: {
      tiny: ['0.625rem', { lineHeight: '1rem', letterSpacing: '0' }],
      extraSmall: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0' }],
      small: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0' }],
      regular: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
      leading: ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
      smallSubheading: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '0' }],
      subheading: ['1.5rem', { lineHeight: '2rem', letterSpacing: '0' }],

      h7: ['1.25rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
      h6: ['1.5rem', { lineHeight: '2rem', letterSpacing: '0' }],
      h5: ['2rem', { lineHeight: '2.25rem', letterSpacing: '0' }],
      h4: ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '0' }],
      h3: ['2.5rem', { lineHeight: '3rem', letterSpacing: '0' }],
      h2: ['3rem', { lineHeight: '3.5rem', letterSpacing: '0' }],
      h1: ['3.75rem', { lineHeight: '4.25rem', letterSpacing: '0' }],

      medium: ['4rem', { lineHeight: '4.5rem', letterSpacing: '0' }],
      large: ['4.5rem', { lineHeight: '5rem', letterSpacing: '0' }],
      extraLarge: ['6rem', { lineHeight: '6.5rem', letterSpacing: '0' }]
    },

    fontFamily: {
      paragraph: ['var(--font-instrument-sans)', ...fontFamily.sans],
      heading: ['var(--font-libre-baskerville)', ...fontFamily.serif]
    },

    colors: {
      transparent: 'transparent',

      neutral: {
        0: 'hsl(var(--neutral-0))',
        25: 'hsl(var(--neutral-25))',
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
      },

      icon: {
        default: 'hsl(var(--neutral-500))',
        subtle: 'hsl(var(--neutral-400))',
        contrast: 'hsl(var(--neutral-950))',
        base: 'hsl(var(--neutral-0))',
        brand: 'hsl(var(--primary-900))',
        'brand-subtle': 'hsl(var(--primary-600))'
      }
    },

    textColor: {
      primary: 'hsl(var(--neutral-950))',
      secondary: 'hsl(var(--neutral-600))',
      tertiary: 'hsl(var(--neutral-500))',
      disabled: 'hsl(var(--neutral-400))',
      brand: 'hsl(var(--primary-950))',
      'brand-subtle': 'hsl(var(--primary-700))',
      'brand-light': 'hsl(var(--primary-400))',
      'brand-secondary': 'hsl(var(--secondary-900))',
      'brand-secondary-subtle': 'hsl(var(--secondary-600))',
      success: 'hsl(var(--success-900))',
      'success-subtle': 'hsl(var(--success-700))',
      warning: 'hsl(var(--warning-900))',
      'warning-subtle': 'hsl(var(--warning-700))',
      alert: 'hsl(var(--alert-900))',
      'alert-subtle': 'hsl(var(--alert-700))',
      base: 'hsl(var(--neutral-0))',
      neutral: {
        '300': 'hsl(var(--neutral-300))'
      },
      icon: {
        default: 'hsl(var(--neutral-500))'
      }
    },

    backgroundColor: {
      transparent: 'transparent',

      surface: {
        base: 'hsl(var(--neutral-0))',
        'base-soft': 'hsl(var(--neutral-25))',
        elevated: 'hsl(var(--neutral-50))',
        'elevated-low-emphasis': 'hsl(var(--neutral-100))',
        'elevated-emphasis': 'hsl(var(--neutral-200))',
        'elevated-contrast': 'hsl(var(--neutral-300))',
        'elevated-high-contrast': 'hsl(var(--neutral-400))',
        'contrast-subtle': 'hsl(var(--neutral-700))',
        contrast: 'hsl(var(--neutral-950))'
      },

      element: {
        base: 'hsl(var(--neutral-0))',
        neutral: 'hsl(var(--neutral-100))',
        'neutral-light': 'hsl(var(--neutral-50))',
        'neutral-subtle': 'hsl(var(--neutral-200))',
        'neutral-emphasis': 'hsl(var(--neutral-300))',
        'neutral-contrast-subtle': 'hsl(var(--neutral-800))',
        'neutral-contrast': 'hsl(var(--neutral-950))',
        primary: 'hsl(var(--primary-900))',
        'primary-light': 'hsl(var(--primary-50))',
        'primary-gentle': 'hsl(var(--primary-100))',
        'primary-soft': 'hsl(var(--primary-600))',
        'primary-subtle': 'hsl(var(--primary-700))',
        'primary-contrast': 'hsl(var(--primary-800))',
        secondary: 'hsl(var(--secondary-600))',
        'secondary-light': 'hsl(var(--secondary-50))',
        'secondary-gentle': 'hsl(var(--secondary-100))',
        'secondary-soft': 'hsl(var(--secondary-400))',
        'secondary-subtle': 'hsl(var(--secondary-500))',
        'secondary-contrast': 'hsl(var(--secondary-700))',
        tertiary: 'hsl(var(--tertiary-400))',
        'tertiary-light': 'hsl(var(--tertiary-50))',
        'tertiary-gentle': 'hsl(var(--tertiary-100))',
        'tertiary-soft': 'hsl(var(--tertiary-200))',
        'tertiary-subtle': 'hsl(var(--tertiary-300))',
        'tertiary-contrast': 'hsl(var(--tertiary-700))',
        success: 'hsl(var(--success-500))',
        'success-light': 'hsl(var(--success-50))',
        'success-gentle': 'hsl(var(--success-100))',
        'success-soft': 'hsl(var(--success-300))',
        'success-subtle': 'hsl(var(--success-400))',
        'success-contrast': 'hsl(var(--success-700))',
        warning: 'hsl(var(--warning-600))',
        'warning-light': 'hsl(var(--warning-50))',
        'warning-gentle': 'hsl(var(--warning-100))',
        'warning-soft': 'hsl(var(--warning-400))',
        'warning-subtle': 'hsl(var(--warning-500))',
        'warning-contrast': 'hsl(var(--warning-700))',
        alert: 'hsl(var(--alert-500))',
        'alert-light': 'hsl(var(--alert-50))',
        'alert-gentle': 'hsl(var(--alert-100))',
        'alert-soft': 'hsl(var(--alert-300))',
        'alert-subtle': 'hsl(var(--alert-400))',
        'alert-contrast': 'hsl(var(--alert-600))'
      },

      neutral: {
        '500': 'hsl(var(--neutral-500))'
      },

      tertiary: {
        '500': 'hsl(var(--tertiary-500))',
        '600': 'hsl(var(--tertiary-600))'
      }
    },

    borderColor: {
      transparent: 'transparent',
      default: 'hsl(var(--neutral-300))',
      subtle: 'hsl(var(--neutral-200))',
      contrast: 'hsl(var(--neutral-950))',
      active: 'hsl(var(--primary-600))',
      brand: 'hsl(var(--primary-900))',
      alert: 'hsl(var(--alert-500))',
      base: 'hsl(var(--neutral-0))',
      'primary-subtle': 'hsl(var(--primary-700))',
      neutral: {
        '100': 'hsl(var(--neutral-100))'
      }
    },

    boxShadowColor: {
      default: 'hsl(var(--neutral-300))',
      subtle: 'hsl(var(--neutral-200))',
      contrast: 'hsl(var(--neutral-950))',
      active: 'hsl(var(--primary-600))',
      brand: 'hsl(var(--primary-900))',
      alert: 'hsl(var(--alert-500))',
      base: 'hsl(var(--neutral-0))',
      secondary: 'hsl(var(--secondary-600))'
    },

    ringColor: {
      default: 'hsl(var(--primary-200))'
    }
  },

  plugins: [require('tailwindcss-animate'), require('tailwindcss-react-aria-components')]
};

export default config;
