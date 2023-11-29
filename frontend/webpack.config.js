/* eslint-disable no-console */
const path = require('path');
const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const parsedArgs = require('yargs').argv;
console.log(parsedArgs);
// Input directory
const APP_DIR = path.resolve(__dirname, './');
// Output directory
const BUILD_DIR = path.resolve(__dirname, 'public', 'build');
const ROOT_DIR = path.resolve(__dirname, '..');

// Extract the mode, devserverPort, measure, analyzeBundle, and analyzerPort from the parsed arguments
const {
  mode = 'development',
  devserverPort = 3000,
  measure = false,
  analyzeBundle = false,
  analyzerPort = 8888,
  nameChunks = false,
} = parsedArgs;

// Set the environment flags based on the mode
const isDevMode = mode !== 'production';
const isProduction = mode === 'production';
const isDevServer = process.argv[1].includes('webpack-dev-server');

// Initialize the output configuration
const output = {
  path: BUILD_DIR,
  publicPath: '/',
};
if (isDevMode) {
  output.filename = '[name].[contenthash:8].entry.js';
  output.chunkFilename = '[name].[contenthash:8].chunk.js';
} else if (nameChunks) {
  output.filename = '[name].[chunkhash].entry.js';
  output.chunkFilename = '[name].[chunkhash].chunk.js';
} else {
  output.filename = '[name].[chunkhash].entry.js';
  output.chunkFilename = '[chunkhash].chunk.js';
}

if (!isDevMode) {
  output.clean = true;
}

// Extracted plugin configurations
const basePlugins = [
  new webpack.ProvidePlugin({
    process: 'process/browser.js',
  }),
  // creates a manifest.json mapping of name to hashed output used in template files
  new WebpackManifestPlugin({
    publicPath: output.publicPath,
    seed: { app: 'lcfs' },
    // This enables us to include all relevant files for an entry
    generate: (seed, files, entrypoints) => {
      const entryFiles = {};
      Object.entries(entrypoints).forEach(([entry, chunks]) => {
        entryFiles[entry] = {
          css: chunks
            .filter(x => x.endsWith('.css'))
            .map(x => `${output.publicPath}${x}`),
          js: chunks
            .filter(x => x.endsWith('.js') && x.match(/(?<!hot-update).js$/))
            .map(x => `${output.publicPath}${x}`),
        };
      });
      return {
        ...seed,
        entrypoints: entryFiles,
      };
    },
    // Also write manifest.json to disk when running `npm run dev`.
    // This is required for Flask to work.
    writeToFileEmit: isDevMode && !isDevServer,
  }),
  new MiniCssExtractPlugin({
    filename: '[name].css',
    chunkFilename: '[id].css',
  }),
  // expose mode variable to other modules
  new webpack.DefinePlugin({
    'process.env.WEBPACK_MODE': JSON.stringify(mode),
    'process.env.REDUX_DEFAULT_MIDDLEWARE':
      process.env.REDUX_DEFAULT_MIDDLEWARE,
  }),
  new HtmlWebpackPlugin({
    title: 'LCFS',
    // chunks: ['bundle', 'vendor'],
    filename: 'index.html',
    inject: 'body',
    favicon: './public/assets/icons/favicon.ico',
    template: './public/index.html',
  }),
];

// Fallback HTML pages
const fallbackHtmlPages = [
  new HtmlWebpackPlugin({
    template: './src/assets/staticPages/404.html',
    inject: true,
    chunks: [],
    filename: '404.html',
  }),
  new HtmlWebpackPlugin({
    template: './src/assets/staticPages/500.html',
    inject: true,
    chunks: [],
    filename: '500.html',
  }),
];

// Development-specific plugins
const devPlugins = [
  new ReactRefreshPlugin(),
  new webpack.HotModuleReplacementPlugin(),
  new CopyPlugin({
    patterns: [
      { from: 'public/config/features.js', to: 'static/js/config/' }, // add local dev config
      { from: 'public/assets/', to: 'assets/' },
    ],
  }),
  // ... (other development plugins)
];
// Bundle analyzer is disabled by default
// Pass flag --analyzeBundle=true to enable
// e.g. npm run build -- --analyzeBundle=true
if (analyzeBundle) {
  devPlugins.push(new BundleAnalyzerPlugin({ analyzerPort }));
}

// Production-specific plugins
const prodPlugins = [
  new CopyPlugin({ patterns: [{ from: 'public/assets/', to: 'assets/' }] }),
  new MiniCssExtractPlugin({
    filename: '[name].[chunkhash].entry.css',
    chunkFilename: '[name].[chunkhash].chunk.css',
  }),
  // ... (other production plugins)
];

// Merge the base plugins with the environment-specific plugins
const plugins = isDevMode
  ? [...basePlugins, ...fallbackHtmlPages, ...devPlugins]
  : [...basePlugins, ...fallbackHtmlPages, ...prodPlugins];

// Extracted optimization configuration
const optimization = {
  sideEffects: true,
  splitChunks: {
    chunks: 'all',
    // Increase minSize for devMode to 1000kb because of the sourcemap
    minSize: isDevMode ? 1000000 : 20000,
    name: nameChunks,
    automaticNameDelimiter: '-',
    minChunks: 2,
    cacheGroups: {
      automaticNamePrefix: 'chunk',
      // Basic stable dependencies
      vendors: {
        priority: 50,
        name: 'vendors',
        test: new RegExp(
          `/node_modules/(${[
            'abortcontroller-polyfill',
            'react',
            'react-dom',
            'prop-types',
            'react-prop-types',
            'prop-types-extra',
            'redux',
            'react-redux',
            'react-select',
            'react-sortable-hoc',
            'react-table',
            'react-ace',
            '@hot-loader.*',
            'webpack.*',
            '@?babel.*',
            'lodash.*',
            'antd',
            '@ant-design.*',
            '.*bootstrap',
            'moment',
            'jquery',
            'core-js.*',
            '@emotion.*',
          ].join('|')})/`,
        ),
      },
      // Viz thumbnails are used in `addSlice` and `explore` page
      thumbnail: {
        name: 'thumbnail',
        test: /thumbnail(Large)?\.(png|jpg)/i,
        priority: 20,
        enforce: true,
      },
    },
  },
  usedExports: 'global',
  minimizer: [new CssMinimizerPlugin(), '...'],
};

// Development-specific optimization settings
const devOptimization = {
  // ... (development optimization settings)
};

// Production-specific optimization settings
const prodOptimization = {
  // ... (production optimization settings)
};

// Merge the base optimization settings with the environment-specific settings
const finalOptimization = isDevMode
  ? { ...optimization, ...devOptimization }
  : { ...optimization, ...prodOptimization };

// Extracted module rules
const moduleRules = [
  {
    test: /\.(js|jsx|ts|tsx)$/,
    // Include source code for plugins, but exclude node_modules and test files within them
    exclude: [/\.test.jsx?$/],
    include: [
      new RegExp(`${APP_DIR}/(src|.storybook|plugins|packages)`),
      ...['./src', './.storybook'].map(p => path.resolve(__dirname, p)), // Redundant but required for Windows
      /@encodable/,
    ],
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-env', '@babel/preset-react'],
      },
    },
  },
  {
    test: /\.(s?)css$/,
    use: [
      {
        loader: MiniCssExtractPlugin.loader,
        options: {},
      },
      {
        loader: 'css-loader',
        options: {
          sourceMap: true,
        },
      },
      {
        loader: 'sass-loader',
        options: {
          sourceMap: true,
        },
      },
    ],
  },
  /* for css linking images (and viz plugin thumbnails) */
  {
    test: /\.png$/,
    issuer: {
      not: [/\/src\/assets\/staticPages\//],
    },
    type: 'asset',
    generator: {
      filename: '[name].[contenthash:8].[ext]',
    },
  },
  {
    test: /\.png$/,
    issuer: /\/src\/assets\/staticPages\//,
    type: 'asset',
  },
  {
    test: /\.ico$/,
    issuer: /\/src\/assets\/staticPages\//,
    type: 'asset',
  },
  {
    test: /\.svg$/i,
    use: ['@svgr/webpack'],
  },
  {
    test: /\.(jpg|gif)$/,
    type: 'asset/resource',
    generator: {
      filename: '[name].[contenthash:8].[ext]',
    },
  },
  /* for font-awesome */
  {
    test: /\.(woff|woff2|eot|ttf|otf)$/i,
    type: 'asset/resource',
  },
  {
    test: /\.ya?ml$/,
    include: ROOT_DIR,
    loader: 'js-yaml-loader',
  },
  {
    test: /.mdx?$/,
    use: ['babel-loader', '@mdx-js/loader'],
  },
];

// Development-specific module rules
const devModuleRules = [
  // ... (development-specific module rules)
];

// Production-specific module rules
const prodModuleRules = [
  // ... (production-specific module rules)
];

// Merge the base module rules with the environment-specific rules
const finalModuleRules = isDevMode
  ? [...moduleRules, ...devModuleRules]
  : [...moduleRules, ...prodModuleRules];

// Define alias paths for resolution
const alias = {
  components: path.resolve(APP_DIR, './src/components'),
  assets: path.resolve(APP_DIR, './src/assets'),
  layouts: path.resolve(APP_DIR, './src/layouts'),
  constants: path.resolve(APP_DIR, './src/constants'),
  styles: path.resolve(APP_DIR, './src/styles'),
  utils: path.resolve(APP_DIR, './src/utils'),
  '@': path.resolve(APP_DIR, 'src'),
  // Add any additional alias paths as needed
};

// Extracted resolve configuration
const resolve = {
  // resolve modules from `/frontend/node_modules` and `/frontend`
  modules: ['node_modules', APP_DIR],
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.yml'],
  fallback: {
    fs: false,
    vm: require.resolve('vm-browserify'),
    path: false,
  },
  alias,
};

// Development-specific resolve settings
const devResolve = {
  // ... (development-specific resolve settings)
};

// Production-specific resolve settings
const prodResolve = {
  // ... (production-specific resolve settings)
};

// Merge the base resolve settings with the environment-specific settings
const finalResolve = isDevMode
  ? { ...resolve, ...devResolve }
  : { ...resolve, ...prodResolve };

// Extracted devServer configuration
const devServer = isDevMode
  ? {
    historyApiFallback: {
      rewrites: [
        { from: /^\/api\/(.*)/, to: '/src/assets/staticPages/404.html' },
        { from: /^\/static\/(.*)/, to: '/src/assets/staticPages/404.html' },
      ],
    },
    client: { overlay: false, logging: 'warn' },
    port: devserverPort,
  }
  : {};

// Extracted configuration object
const baseConfig = {
  entry: './src/index.js',
  stats: 'minimal',
  context: APP_DIR,
  devtool: 'source-map',
  performance: {
    assetFilter(assetFilename) {
      // Exclude specific file types from performance warnings
      return !/\.(map|geojson|woff2)$/.test(assetFilename);
    },
  },
};

// Merge all the environment-specific settings into the base configuration
const config = {
  ...baseConfig,
  mode: isProduction ? 'production' : 'development',
  output,
  plugins,
  optimization: finalOptimization,
  module: {
    rules: finalModuleRules,
  },
  resolve: finalResolve,
  devServer,
};

// ... (remaining configurations)

// Finalize the webpack configuration with optional speed measurement
const smp = new SpeedMeasurePlugin({
  disable: !measure,
});

module.exports = smp.wrap(config);
