/** @type {import('prettier').Config} */
module.exports = {
  ...require('@zivoe/prettier-config/prettier.config.cjs'),
  plugins: ['@trivago/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss']
};
