module.exports = {
  root: true,
  env: { browser: true, es2020: true, jest: true },
  extends: [
    'standard',
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:storybook/recommended',
    'plugin:cypress/recommended',
    'plugin:chai-friendly/recommended',
    'prettier'
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json']
  },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh', 'cypress', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true }
    ],
    'import/no-absolute-path': 0,
    'react/prop-types': 0,
    'cypress/no-unnecessary-waiting': 0,
    'no-unused-vars': 1,
    '@typescript-eslint/no-unused-vars': 'warn'
  },
  globals: {
    vi: true
  }
}
