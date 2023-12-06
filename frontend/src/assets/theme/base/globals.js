import colors from "assets/theme/base/colors";
import BCSansRegularTTF from 'assets/fonts/BCSans-Regular_2f.woff2';
import BCSansBoldTTF from 'assets/fonts/BCSans-Bold_2f.woff2';
import BCSansBoldItalicTTF from 'assets/fonts/BCSans-BoldItalic_2f.woff2';
import BCSansItalicTTF from 'assets/fonts/BCSans-Italic_2f.woff2';
import BCSansLightTTF from 'assets/fonts/BCSans-Light_2f.woff2';
import BCSansLightItalicTTF from 'assets/fonts/BCSans-LightItalic_2f.woff2';
import bceidImg from 'assets/images/bceid.png';

const { info, link, text, background, primary, light, transparent } = colors;

const bcSansRegular = {
  fontFamily: "BCSans",
  fontStyle: "normal",
  src: `url(${BCSansRegularTTF}) format('woff2')`
}

const bcSansBold = {
  fontFamily: "BCSans",
  fontWeight: 700,
  src: `url(${BCSansBoldTTF}) format('woff2')`
}

const bcSansBoldItalic = {
  fontFamily: "BCSans",
  fontWeight: 700,
  fontStyle: "italic",
  src: `url(${BCSansBoldItalicTTF}) format('woff2')`
}

const bcSansItalic = {
  fontFamily: "BCSans",
  fontStyle: "italic",
  src: `url(${BCSansItalicTTF}) format('woff2')`
}

const bcSansLight = {
  fontFamily: "BCSans",
  fontStyle: "italic",
  src: `url(${BCSansLightTTF}) format('woff2')`
}

const bcSansLightItalic = {
  fontFamily: "BCSans",
  fontStyle: "italic",
  src: `url(${BCSansLightItalicTTF}) format('woff2')`
}

const globals = {
  html: [{ scrollBehavior: "smooth" },
  { '@font-face': bcSansRegular },
  { '@font-face': bcSansBold },
  { '@font-face': bcSansBoldItalic },
  { '@font-face': bcSansItalic },
  { '@font-face': bcSansLight },
  { '@font-face': bcSansLightItalic },
  ],
  "*, *::before, *::after": {
    margin: 0,
    padding: 0,
  },
  '#root': {
    backgroundColor: background.paper,
  },
  "a, a:link, a:visited": {
    textDecoration: "none !important",
  },
  "a.link, .link, a.link:link, .link:link, a.link:visited, .link:visited": {
    color: `${link.main} !important`,
    transition: "color 150ms ease-in !important",
  },
  "a.link:hover, .link:hover, a.link:focus, .link:focus": {
    color: `${info.main} !important`,
  },
  '.ag-theme-alpine': {
    '--ag-foreground-color': `${text.primary}`,
    // '--ag-background-color': `${background.default}`,
    // '--ag-header-foreground-color': `${background.nav}`,
    // '--ag-header-background-color': `${primary.nav}`,
    '--ag-odd-row-background-color': 'rgb(0, 0, 0, 0.08)',
    // '--ag-header-column-resize-handle-color': 'rgb(126, 46, 132)',

    '--ag-font-size': '17px',
    '--ag-font-family': "'BCSans', 'Noto Sans', 'Verdana', 'Arial', 'sans-serif'",
  },
  '.bceid-name': {
    textIndent: '-9999px',
    backgroundImage: `url(${bceidImg})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
    height: '1.15rem',
    width: '6rem',
  },
  '#link-idir': {
    textAlign: 'right',
    color: `${primary.main}`,
    '&:hover': {
      color: `${light.main}`
    }
  },
};

export default globals;