import turboConfig from 'eslint-config-turbo/flat';
import reactHooks from 'eslint-plugin-react-hooks';

/** Flat-config blocks every consumer shares. Currently just turbo's env-var rule. */
export const BASE_CONFIGS = [...turboConfig];

/** Plugins every consumer registers. Rules for these live in BASE_RULES. */
export const BASE_PLUGINS = {
  'react-hooks': reactHooks,
};

export const BASE_IGNORES = [
  '.next/**',
  'node_modules/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '**/*.d.ts',
  '**/*.{js,cjs,mjs}',
];

export const BASE_RULES = {
  '@typescript-eslint/array-type': ['error', { default: 'generic' }],
  '@typescript-eslint/consistent-type-definitions': 'off',
  '@typescript-eslint/consistent-type-imports': [
    'warn',
    {
      prefer: 'type-imports',
      fixStyle: 'inline-type-imports',
    },
  ],
  '@typescript-eslint/no-unused-vars': [
    'warn',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    },
  ],
  '@typescript-eslint/require-await': 'off',
  '@typescript-eslint/no-misused-promises': [
    'error',
    {
      checksVoidReturn: {
        attributes: false,
      },
    },
  ],
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/no-floating-promises': 'warn',

  // The two correctness rules. eslint-plugin-react-hooks v7 ships a much larger
  // `recommended` set, but the rest of it is React Compiler linting — a separate
  // opt-in with its own migration cost, so enable these two explicitly.
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
};
