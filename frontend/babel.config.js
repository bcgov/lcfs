const packageConfig = require('./package');

module.exports = {
  sourceMaps: true,
  sourceType: 'module',
  retainLines: true,
  presets: [
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'usage',
        corejs: 3,
        loose: true,
        modules: false,
        shippedProposals: true,
        targets: packageConfig.browserslist,
      },
    ],
    // Enable development transform of React with new automatic runtime
    ['@babel/preset-react', { development: process.env.BABEL_ENV === 'development', runtime: 'automatic' }],
    '@babel/preset-typescript',
    [
      '@emotion/babel-preset-css-prop',
      {
        autoLabel: 'dev-only',
        labelFormat: '[local]',
      },
    ],
  ],
  plugins: [
    '@babel/plugin-syntax-dynamic-import',
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-proposal-optional-chaining', { loose: true }],
    ['@babel/plugin-proposal-private-methods', { loose: true }],
    ['@babel/plugin-proposal-nullish-coalescing-operator', { loose: true }],
    ['@babel/plugin-transform-runtime', { corejs: 3 }],
  ],
  env: {
    // Setup a different config for tests as they run in node instead of a browser
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            useBuiltIns: 'usage',
            corejs: 3,
            loose: true,
            shippedProposals: true,
            modules: 'commonjs',
            targets: { node: 'current' },
          },
        ],
        ['@emotion/babel-preset-css-prop'],
      ],
      plugins: ['babel-plugin-dynamic-import-node'],
    },
    // build instrumented code for testing code coverage with Cypress
    instrumented: {
      plugins: [
        [
          'istanbul',
          {
            exclude: ['plugins/**/*', 'packages/**/*'],
          },
        ],
      ],
    },
    production: {
      plugins: [
        [
          'babel-plugin-jsx-remove-data-test-id',
          {
            attributes: 'data-test',
          },
        ],
      ],
    },
    testableProduction: {
      plugins: [],
    },
  },
  overrides: [
    {
      test: './plugins/plugin-chart-handlebars/node_modules/just-handlebars-helpers/*',
      sourceType: 'unambiguous',
    },
  ],
  // Applies the react-refresh Babel plugin on non-production modes only
  ...(process.env.BABEL_ENV !== 'production' && { plugins: ['react-refresh/babel'] }),
};