// const packageConfig = require('./package');

const importCoreModules = [];

// ignore files in production mode
let ignorePatterns = [];
if (process.env.NODE_ENV === 'production') {
  ignorePatterns = ['*.test.{js,ts,jsx,tsx}', 'packages/**/test/**/*'];
}

module.exports = {
  extends: [
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime',
    'standard',
    'prettier',
  ],
  parser: '@babel/eslint-parser',
  env: {
    browser: true,
    node: true,
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        moduleDirectory: ['node_modules', '.'],
      },
    },
    // only allow import from top level of module
    'import/core-modules': importCoreModules,
    react: {
      version: 'detect',
    },
  },
  plugins: [
    'prettier',
    'standard',
    'promise',
    'import',
    'node',
    'jsx-a11y',
    'react',
    // 'theme-colors',
    // 'translation-vars',
  ],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      extends: ['standard', 'prettier'],
      plugins: ['@typescript-eslint/eslint-plugin', 'prettier', 'react'],
      rules: {
        '@typescript-eslint/ban-ts-ignore': 0,
        '@typescript-eslint/ban-ts-comment': 0,
        '@typescript-eslint/ban-types': 0,
        '@typescript-eslint/no-empty-function': 0,
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/no-use-before-define': 1,
        '@typescript-eslint/no-non-null-assertion': 0,
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/explicit-module-boundary-types': 0,
        '@typescript-eslint/prefer-optional-chain': 2,
        camelcase: 0,
        'class-methods-use-this': 0,
        'func-names': 0,
        'guard-for-in': 0,
        'import/no-cycle': 0,
        'import/extensions': [
          'error',
          {
            '.ts': 'always',
            '.tsx': 'always',
            '.json': 'always',
          },
        ],
        'import/no-named-as-default-member': 0,
        'import/prefer-default-export': 0,
        indent: 0,
        'jsx-a11y/anchor-is-valid': 1,
        'jsx-a11y/click-events-have-key-events': 0,
        'jsx-a11y/mouse-events-have-key-events': 0,
        'max-classes-per-file': 0,
        'new-cap': 0,
        'no-bitwise': 0,
        'no-continue': 0,
        'no-mixed-operators': 0,
        'no-multi-assign': 0,
        'no-multi-spaces': 0,
        'no-nested-ternary': 0,
        'no-prototype-builtins': 0,
        'no-restricted-properties': 0,
        'no-shadow': 0,
        'no-use-before-define': 0,
        'padded-blocks': 0,
        'prefer-arrow-callback': 0,
        'prefer-destructuring': ['error', { object: true, array: false }],
        'react/destructuring-assignment': 0,
        'react/forbid-prop-types': 0,
        'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }],
        'react/jsx-fragments': 1,
        'react/jsx-no-bind': 0,
        'react/jsx-props-no-spreading': 0,
        'react/no-array-index-key': 0,
        'react/no-string-refs': 0,
        'react/no-unescaped-entities': 0,
        'react/no-unused-prop-types': 0,
        'react/prop-types': 0,
        'react/require-default-props': 0,
        'react/sort-comp': 0,
        'react/static-property-placement': 0,
        'prettier/prettier': 'error',
        'file-progress/activate': 1,
      },
      settings: {
        'import/resolver': {
          typescript: {},
        },
        react: {
          version: 'detect',
        },
      },
    },
    {
      files: [
        '*.test.ts',
        '*.test.tsx',
        '*.test.js',
        '*.test.jsx',
        '*.stories.tsx',
        '*.stories.jsx',
        'fixtures.*',
      ],
      excludedFiles: 'cypress-base/cypress/**/*',
      plugins: [
        'jest',
        'jest-dom',
        // 'no-only-tests',
        'testing-library',
      ],
      env: {
        'jest/globals': true,
      },
      settings: {
        jest: {
          version: 'detect',
        },
      },
      extends: [
        'plugin:jest/recommended',
        'plugin:jest-dom/recommended',
        'plugin:testing-library/react',
      ],
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
        // 'no-only-tests/no-only-tests': 'error',
        'max-classes-per-file': 0,
      },
    },
    {
      files: [
        '*.test.ts',
        '*.test.tsx',
        '*.test.js',
        '*.test.jsx',
        '*.stories.tsx',
        '*.stories.jsx',
        'fixtures.*',
        'cypress-base/cypress/**/*',
        'Stories.tsx',
      ],
      rules: {
        // 'theme-colors/no-literal-colors': 0,
        // 'translation-vars/no-template-vars': 0,
        'no-restricted-imports': 0,
      },
    },
  ],
  rules: {
    // 'theme-colors/no-literal-colors': 'error',
    // 'translation-vars/no-template-vars': ['error', true],
    camelcase: [
      'error',
      {
        allow: ['^UNSAFE_'],
        properties: 'never',
      },
    ],
    'class-methods-use-this': 0,
    curly: 2,
    'func-names': 0,
    'guard-for-in': 0,
    'import/extensions': [
      'error',
      {
        '.js': 'always',
        '.jsx': 'always',
        '.ts': 'always',
        '.tsx': 'always',
        '.json': 'always',
      },
    ],
    'import/no-cycle': 0,
    'import/prefer-default-export': 0,
    indent: 0,
    'jsx-a11y/anchor-is-valid': 1,
    'jsx-a11y/click-events-have-key-events': 0,
    'jsx-a11y/mouse-events-have-key-events': 0,
    'new-cap': 0,
    'no-bitwise': 0,
    'no-continue': 0,
    'no-mixed-operators': 0,
    'no-multi-assign': 0,
    'no-multi-spaces': 0,
    'no-nested-ternary': 0,
    'no-prototype-builtins': 0,
    'no-restricted-properties': 0,
    'no-restricted-imports': [
      'warn',
      {
        paths: [
          {
            name: 'antd',
            message:
              'Please import Ant components from the index of src/components',
          },
          // {
          //   name: '@lcfs-ui/core',
          //   importNames: ['lcfsTheme'],
          //   message:
          //     'Please use the theme directly from the ThemeProvider rather than importing lcfsTheme.',
          // },
        ],
      },
    ],
    'no-shadow': 0,
    'padded-blocks': 0,
    'prefer-arrow-callback': 0,
    'prefer-object-spread': 1,
    'prefer-destructuring': ['error', { object: true, array: false }],
    'react/destructuring-assignment': 0,
    'react/forbid-prop-types': 0,
    'react/jsx-filename-extension': [
      1,
      { extensions: ['.js', '.jsx', '.tsx'] },
    ],
    'react/jsx-fragments': 1,
    'react/jsx-no-bind': 0,
    'react/jsx-props-no-spreading': 0,
    'react/no-array-index-key': 0,
    'react/no-string-refs': 0,
    'react/no-unescaped-entities': 0,
    'react/no-unused-prop-types': 0,
    'react/prop-types': 0,
    'react/require-default-props': 0,
  },
  ignorePatterns,
};
