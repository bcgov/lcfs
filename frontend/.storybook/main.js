/** @type { import('@storybook/react-webpack5').StorybookConfig } */

const path = require('path');

const config = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-onboarding',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  staticDirs: ['../public'],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  reactOptions: {
    fastRefresh: true,
  },
  webpackFinal: async (config, { configType }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      assets: path.resolve(__dirname, '../src/assets'), // replace '../src/assets' with your desired base URL
      components: path.resolve(__dirname, '../src/components'), // replace '../src/components' with your desired base URL
      context: path.resolve(__dirname, '../src/context'),
      examples: path.resolve(__dirname, '../src/examples'),
    };

    // Add any necessary webpack rules or configurations here

    return config;
  },
};
export default config;
