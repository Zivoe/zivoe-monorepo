/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@zivoe/eslint-config/next.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true
  }
};
