import 'server-only';

import { type TailwindConfig, pixelBasedPreset } from '@react-email/components';

import { BASE_URL } from '../base-url';

export const emailTailwindConfig: TailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      fontSize: {
        extraSmall: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0' }],
        small: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0' }],
        regular: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
        leading: ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
        h5: ['2rem', { lineHeight: '2.25rem', letterSpacing: '0' }]
      },
      fontFamily: {
        heading: ['Georgia', 'Times New Roman', 'serif']
      },
      colors: {
        neutral: {
          0: '#FFFFFF',
          25: '#FCFCFD',
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#E4E5EB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#6B7085',
          950: '#12131A'
        },
        primary: {
          50: '#E6F7F7',
          100: '#CCF0F0',
          500: '#009999',
          600: '#008080',
          900: '#004D4D'
        }
      },
      textColor: {
        primary: { DEFAULT: '#12131A' },
        secondary: '#6B7085',
        disabled: '#D1D5DB',
        base: '#FFFFFF',
        brand: '#004D4D',
        'brand-subtle': '#008080'
      },
      backgroundColor: {
        surface: {
          base: '#FFFFFF',
          'base-soft': '#FCFCFD',
          elevated: '#F9FAFB',
          brand: '#004D4D'
        }
      },
      borderColor: {
        subtle: '#E5E7EB',
        active: '#008080'
      }
    }
  }
};

export const ZIVOE_LOGO_URL = `${BASE_URL}/zivoe-logo-email.png`;
export const THOR_AVATAR_URL = `${BASE_URL}/thor-avatar.jpg`;
