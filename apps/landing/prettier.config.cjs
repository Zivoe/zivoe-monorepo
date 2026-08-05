/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
module.exports = {
  ...require('@zivoe/prettier-config/prettier.config.cjs'),
  plugins: ['@trivago/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],
  // See apps/dapp/prettier.config.cjs — Tailwind v4 needs the CSS entrypoint to sort classes.
  tailwindStylesheet: './src/app/globals.css'
};
