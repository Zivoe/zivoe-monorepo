import { type TailwindConfig, pixelBasedPreset } from '@react-email/components';

export const emailTailwindConfig: TailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
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
      }
    }
  }
};

// TODO: Upload the logo
export const ZIVOE_LOGO_URL = 'https://app.zivoe.com/zivoe-logo.png';
