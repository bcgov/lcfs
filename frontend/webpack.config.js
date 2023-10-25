/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const {
  WebpackManifestPlugin,
} = require('webpack-manifest-plugin');
// const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const parsedArgs = require('yargs').argv;
// const getProxyConfig = require('./webpack.proxy-config');
const packageConfig = require('./package');

// input dir
const APP_DIR = path.resolve(__dirname, './');
// output dir
const BUILD_DIR = path.resolve(__dirname, 'public', 'build')
const ROOT_DIR = path.resolve(__dirname, '..');

const {
  mode = 'development',
  devserverPort = 3000,
  measure = false,
  analyzeBundle = false,
  analyzerPort = 8888,
  nameChunks = false,
} = parsedArgs;
const isDevMode = mode !== 'production';
const isProduction = mode === 'production';
const isDevServer = process.argv[1].includes('webpack-dev-server');

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

const plugins = [
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
    chunkFilename: '[id].css'
  }),
  // expose mode variable to other modules
  new webpack.DefinePlugin({
    'process.env.WEBPACK_MODE': JSON.stringify(mode),
    'process.env.REDUX_DEFAULT_MIDDLEWARE':
      process.env.REDUX_DEFAULT_MIDDLEWARE,
  }),

  new CopyPlugin(
    (!isDevMode)
      ? { patterns: [{ from: 'public/assets/', to: 'assets/' }] }
      : {
        patterns: [
          { from: 'public/config/features.js', to: 'static/js/config/' }, // add local dev config
          { from: 'public/assets/', to: 'assets/' }
        ]
      }
  ),

  // static pages
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
  new HtmlWebpackPlugin({
    title: 'LCFS',
    // chunks: ['bundle', 'vendor'],
    filename: 'index.html',
    inject: 'body',
    favicon: './public/assets/icons/favicon.ico',
    template: './public/index.html'
  }),
];

if (!isDevMode) {
  // text loading (webpack 4+)
  plugins.push(
    new MiniCssExtractPlugin({
      filename: '[name].[chunkhash].entry.css',
      chunkFilename: '[name].[chunkhash].chunk.css',
    }),
  );
}

const PREAMBLE = [path.join(APP_DIR, '/src/index.js')];
if (isDevMode) {
  PREAMBLE.unshift(
    `webpack-dev-server/client?http://localhost:${devserverPort}`,
  );
  plugins.push(new ReactRefreshPlugin())
  plugins.push(new webpack.HotModuleReplacementPlugin())
}

const config = {
  mode: isProduction ? 'production' : 'development',
  entry: './src/index.js',
  output,
  stats: 'minimal',
  performance: {
    assetFilter(assetFilename) {
      // don't throw size limit warning on geojson and font files
      return !/\.(map|geojson|woff2)$/.test(assetFilename);
    },
  },
  optimization: {
    sideEffects: true,
    splitChunks: {
      chunks: 'all',
      // increase minSize for devMode to 1000kb because of sourcemap
      minSize: isDevMode ? 1000000 : 20000,
      name: nameChunks,
      automaticNameDelimiter: '-',
      minChunks: 2,
      cacheGroups: {
        automaticNamePrefix: 'chunk',
        // basic stable dependencies
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
        // viz thumbnails are used in `addSlice` and `explore` page
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
  },
  resolve: {
    // resolve modules from `/frontend/node_modules` and `/frontend`
    modules: ['node_modules', APP_DIR],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.yml'],
    fallback: {
      fs: false,
      vm: require.resolve('vm-browserify'),
      path: false,
    },
  },
  context: APP_DIR, // to automatically find tsconfig.json
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        // include source code for plugins, but exclude node_modules and test files within them
        exclude: [/lcfs-ui.*\/node_modules\//, /\.test.jsx?$/],
        include: [
          new RegExp(`${APP_DIR}/(src|.storybook|plugins|packages)`),
          ...['./src', './.storybook', './plugins', './packages'].map(p =>
            path.resolve(__dirname, p),
          ), // redundant but required for windows
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
            options: {}
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true
            }
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: true
            }
          },
          {
            loader: 'style-loader',
            options: { sourceMap: true }
          }
        ]
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
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        issuer: /\.([jt])sx?$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              titleProp: true,
              ref: true,
              // this is the default value for the icon. Using other values
              // here will replace width and height in svg with 1em
              icon: false,
            },
          },
        ],
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
        use: [
          'babel-loader',
          '@mdx-js/loader'
        ]
      }
    ],
  },
  externals: {
    cheerio: 'window',
    'react/lib/ExecutionEnvironment': true,
    'react/lib/ReactContext': true,
  },
  plugins,
  devtool: 'source-map',
};

// find all the symlinked plugins and use their source code for imports
Object.entries(packageConfig.dependencies).forEach(([pkg, relativeDir]) => {
  const srcPath = path.join(APP_DIR, `./node_modules/${pkg}/src`);
  const dir = relativeDir.replace('file:', '');

  if (/^@lcfs-ui/.test(pkg) && fs.existsSync(srcPath)) {
    console.log(`[LCFS Plugin] Use symlink source for ${pkg} @ ${dir}`);
    config.resolve.alias[pkg] = path.resolve(APP_DIR, `${dir}/src`);
  }
});
console.log(''); // pure cosmetic new line

if (isDevMode) {
  config.devServer = {
    historyApiFallback: {
      rewrites: [
        { from: /^\/api\/(.*)/, to: '/src/assets/staticPages/404.html' },
        { from: /^\/static\/(.*)/, to: '/src/assets/staticPages/404.html' },
      ]
    },
    hot: true,
    client: { overlay: false, logging: 'warn' },
    port: devserverPort
  }
}
// Bundle analyzer is disabled by default
// Pass flag --analyzeBundle=true to enable
// e.g. npm run build -- --analyzeBundle=true
if (analyzeBundle) {
  config.plugins.push(new BundleAnalyzerPlugin({ analyzerPort }));
}

// Speed measurement is disabled by default
// Pass flag --measure=true to enable
// e.g. npm run build -- --measure=true
const smp = new SpeedMeasurePlugin({
  disable: !measure,
});

module.exports = smp.wrap(config);
