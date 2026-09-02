import 'server-only';

import { type TailwindConfig, pixelBasedPreset } from '@react-email/components';

import { BASE_URL } from '../base-url';

export const emailTailwindConfig: TailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      // px, not rem: pixelBasedPreset converts only Tailwind's stock scales,
      // so custom tokens (and the radii below) would inline as rem, which
      // Outlook for Windows ignores.
      fontSize: {
        extraSmall: ['12px', { lineHeight: '16px', letterSpacing: '0' }],
        small: ['14px', { lineHeight: '20px', letterSpacing: '0' }],
        regular: ['16px', { lineHeight: '24px', letterSpacing: '0' }],
        leading: ['18px', { lineHeight: '24px', letterSpacing: '0' }],
        h5: ['32px', { lineHeight: '36px', letterSpacing: '0' }]
      },
      borderRadius: {
        md: '6px',
        lg: '8px',
        xl: '12px'
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
