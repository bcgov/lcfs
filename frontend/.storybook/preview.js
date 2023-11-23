/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;

import { CssBaseline, ThemeProvider } from "@mui/material";
import theme from "../src/assets/theme"
import { BrowserRouter } from "react-router-dom";
export const withMuiTheme = (Story) => (
  <BrowserRouter>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Story />
    </ThemeProvider>
  </BrowserRouter>
);

export const decorators = [withMuiTheme];

