/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
module.exports = {
  ...require('@zivoe/prettier-config/prettier.config.cjs'),
  plugins: ['@trivago/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],
  // Tailwind v4 has no JS config for the class sorter to auto-detect, so it needs the CSS
  // entrypoint explicitly — otherwise every `@theme` utility sorts as an unknown class and
  // gets hoisted to the front. Resolved relative to this file, so any cwd works.
  tailwindStylesheet: './src/app/globals.css'
};
