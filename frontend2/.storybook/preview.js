import defaultTheme from '@/assets/theme';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { withThemeFromJSXProvider } from '@storybook/addon-themes';
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/material-icons";


/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;


export const decorators = [ withThemeFromJSXProvider({
  GlobalStyles: CssBaseline,
  Provider: ThemeProvider,
  themes: {
    // Provide your custom themes here
    light: defaultTheme,
    // dark: darkTheme,
  },
  defaultTheme: 'light',
})];