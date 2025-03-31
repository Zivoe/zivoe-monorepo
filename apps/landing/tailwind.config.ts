import { type Config } from 'tailwindcss';

import sharedConfig from '@zivoe/ui/tailwind.config.ts';

const config: Config = {
  content: [
    './src/**/*.tsx',
    '../../packages/ui/src/components/**/*.{ts,tsx}',
    '../../packages/ui/src/core/**/*.{ts,tsx}'
  ],
  presets: [sharedConfig]
};

export default config;
