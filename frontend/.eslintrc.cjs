module.exports = {
  root: true,
  env: { browser: true, es2020: true, jest: true },
  extends: [
    'standard',
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:storybook/recommended',
    'plugin:cypress/recommended',
    'plugin:chai-friendly/recommended',
    'prettier',
    'plugin:@typescript-eslint/recommended'
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  // parserOptions: {
  //   ecmaVersion: 2020,
  //   sourceType: 'module',
  //   ecmaFeatures: {
  //     jsx: true
  //   }
  // },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh', 'cypress', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true }
    ],
    'import/no-absolute-path': 0,
    'react/prop-types': 0,
    'cypress/no-unnecessary-waiting': 0,
    'no-unused-vars': 1
  },
  globals: {
    vi: true
  }
}
