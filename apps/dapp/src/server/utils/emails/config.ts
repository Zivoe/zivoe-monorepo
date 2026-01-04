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

// TODO: Upload the logo to our next js app
export const ZIVOE_LOGO_URL = 'https://0y6j06m0os.ufs.sh/f/2CBiWT05Di8GOe61kB4it3PjRXd4A0ekG2v7oaIQpwWhTJVM';

// TODO: Upload Thor's headshot to our next js app
export const THOR_AVATAR_URL = 'https://0y6j06m0os.ufs.sh/f/2CBiWT05Di8GZs0hTDnfCWhyzMENnowG9Imp7FYkxsejTbRr';

export const EMAILS = {
  INVESTORS: 'investors@zivoe.com',
  INQUIRE: 'inquire@zivoe.com'
} as const;
