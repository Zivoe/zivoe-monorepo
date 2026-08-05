// No Tailwind in this package, so drop the class sorter and the options that only it reads.
const { tailwindFunctions, ...base } = require('@zivoe/prettier-config/prettier.config.cjs');

/** @type {import('prettier').Config} */
module.exports = {
  ...base,
  plugins: ['@trivago/prettier-plugin-sort-imports']
};
