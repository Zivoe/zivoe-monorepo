import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';

import { nextConfig } from '@zivoe/eslint-config/next.mjs';

export default nextConfig({
  tsconfigRootDir: import.meta.dirname,
  extraIgnores: ['archived/**'],
  tseslint,
  nextPlugin,
});
