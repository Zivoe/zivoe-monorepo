import { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  docs: { autodocs: 'tag' },
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-onboarding',
    '@storybook/addon-interactions',
    '@storybook/addon-themes'
  ],
  stories: [
    {
      directory: '../../../packages/ui/src/**',
      titlePrefix: 'Zivoe UI',
      files: '*.stories.*'
    }
  ],
  viteFinal: async (config) => {
    return config;
  }
};

export default config;
