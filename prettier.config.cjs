/** @type {import('prettier').Config} */
module.exports = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: [
    // Optional, improves class sorting with Tailwind v4
    'prettier-plugin-tailwindcss',
  ],
};
