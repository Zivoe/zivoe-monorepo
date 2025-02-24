import { type Config } from 'tailwindcss';

const config: Config = {
  content: ['../../packages/ui/src/components/**/*.{ts,tsx}', '../../packages/ui/src/core/**/*.{ts,tsx}'],
  presets: [require('@zivoe/ui/tailwind')]
};

export default config;
