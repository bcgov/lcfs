// Some of the references from https://developer.gov.bc.ca/Design-System/Colour-Palette
const colors = {
  mode: 'light',
  common: {
    black: '#000',
    white: '#fff',
  },
  // Primary BC Brand
  // Used for header, footer, primary button
  primary: {
    main: '#003366',
    focus: '#003366',
    nav: '#036',
  },
  // Used for header, footer, beta status
  secondary: {
    main: '#fcba19',
    focus: '#fcba19',
    nav: '#38598a',
  },
  // Sematic colours
  // Error messages and indicators
  error: {
    main: '#d8292f',
    focus: 'd8292f',
  },
  success: {
    main: '#2e8540',
    focus: '#2e8540',
  },
  info: {
    main: '#1A73E8',
    focus: '#1662C4',
  },
  warning: {
    main: '#fb8c00',
    focus: '#fc9d26',
  },
  grey: {
    100: '#f8f9fa',
    200: '#f0f2f5',
    300: '#dee2e6',
    400: '#ced4da',
    500: '#adb5bd',
    600: '#6c757d',
    700: '#495057',
    800: '#343a40',
    900: '#212529',
  },
  // Backgrounds
  background: {
    default: '#ffffff', // Used for backgrounds
    grey: '#f2f2f2',
    nav: '#38598a', // Used for Nav bar
    opaque: 'transparent',
    paper: '#F3F6F9',
  },
  // Used for headings and paragraphs
  text: {
    primary: '#313132',
    secondary: '#313132',
    disabled: 'rgba(0,0,0,0.38)',
  },
  transparent: {
    main: 'transparent',
  },

  white: {
    main: '#ffffff',
    focus: '#ffffff',
  },

  black: {
    light: '#000000',
    main: '#000000',
    focus: '#000000',
  },
  // Links
  link: {
    main: '#1a5a96',
    focus: '#1a5a96',
  },
  // Used for text input, textarea, checkbox, radio button
  input: {
    main: '#606060',
    focus: '#606060',
  },

  light: {
    main: '#f0f2f5',
    focus: '#f0f2f5',
  },
  dark: {
    main: '#344767',
    focus: '#2c3c58',
  },
  coloredShadows: {
    primary: '#fcba19',
    secondary: '#110e0e',
    info: '#00bbd4',
    success: '#4caf4f',
    warning: '#ff9900',
    error: '#f44336',
    light: '#adb5bd',
    dark: '#404040',
  },
  inputBorderColor: '#d2d6da',

  tabs: {
    indicator: { boxShadow: '#ddd' },
  },
  alerts: {
    success: {
      color: '#2d4821',
      border: '#d6e9c6',
      background: '#dff0d8',
    },
    warning: {
      color: '#6c4a00',
      border: '#faebcc',
      background: '#f9f1c6',
    },
    info: {
      color: '#313132',
      border: 'transparent',
      background: '#d9eaf7',
    },
    error: {
      color: '#a12622',
      border: '#ebccd1',
      background: '#f2dede',
    },
  },
  gradients: {
    primary: {
      main: '#003366',
      state: '#036',
    },

    secondary: {
      main: '#fcba19',
      state: '#fcba19',
    },

    info: {
      main: '#d9eaf7',
      state: '#d9eaf7',
    },

    success: {
      main: '#dff0d8',
      state: '#d6e9c6',
    },

    warning: {
      main: '#f9f1c6',
      state: '#faebcc',
    },

    error: {
      main: '#d8292f',
      state: '#d8292f',
    },

    light: {
      main: '#f2f2f2',
      state: '#f3f6f9',
    },

    dark: {
      main: '#313132',
      state: '#606060',
    },
  },
};

export default colors;
