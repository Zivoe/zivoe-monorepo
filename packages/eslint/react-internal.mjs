import { BASE_CONFIGS, BASE_IGNORES, BASE_PLUGINS, BASE_RULES } from './base.mjs';

/**
 * Shared ESLint flat config for internal (non-Next.js) packages.
 * Plugins are passed in by the consumer to avoid pnpm resolution issues.
 *
 * @param {{ tsconfigRootDir: string, extraIgnores?: string[], tseslint: any }} options
 */
export function reactInternalConfig({
  tsconfigRootDir,
  extraIgnores = [],
  tseslint,
}) {
  return tseslint.config([
    { ignores: [...BASE_IGNORES, ...extraIgnores] },
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    ...BASE_CONFIGS,
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        parserOptions: {
          project: true,
          tsconfigRootDir,
        },
      },
      plugins: {
        ...BASE_PLUGINS,
      },
      rules: {
        ...BASE_RULES,
      },
    },
  ]);
}
