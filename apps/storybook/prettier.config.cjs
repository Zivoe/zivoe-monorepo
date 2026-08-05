/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
module.exports = {
  ...require('@zivoe/prettier-config/prettier.config.cjs'),
  plugins: ['@trivago/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],
  // See apps/dapp/prettier.config.cjs. Storybook has no stylesheet of its own; it renders
  // the shared one via `import '@zivoe/ui/globals.css'` in .storybook/preview.ts.
  tailwindStylesheet: '../../packages/ui/src/globals.css'
};
