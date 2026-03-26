import { BASE_IGNORES, BASE_RULES } from './base.mjs';

/**
 * Shared ESLint flat config for Next.js apps.
 * Plugins are passed in by the consumer to avoid pnpm resolution issues.
 *
 * @param {{ tsconfigRootDir: string, extraIgnores?: string[], tseslint: any, nextPlugin: any }} options
 */
export function nextConfig({
  tsconfigRootDir,
  extraIgnores = [],
  tseslint,
  nextPlugin,
}) {
  return tseslint.config([
    { ignores: [...BASE_IGNORES, ...extraIgnores] },
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        parserOptions: {
          project: true,
          tsconfigRootDir,
        },
      },
      plugins: {
        '@next/next': nextPlugin,
      },
      rules: {
        ...BASE_RULES,
        ...nextPlugin.configs['core-web-vitals'].rules,
        '@typescript-eslint/await-thenable': 'off',
        '@next/next/no-html-link-for-pages': 'off',
      },
    },
  ]);
}
