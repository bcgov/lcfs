// @mui material components
import { createTheme } from '@mui/material/styles';
import breakpoints from 'assets/theme/base/breakpoints';
import boxShadows from 'assets/theme/base/shadows';
import borders from 'assets/theme/base/borders';
import colors from 'assets/theme/base/colors';
import container from 'assets/theme/base/container';
import typography from 'assets/theme/base/typography';
import button from 'assets/theme/components/button';
import globals from 'assets/theme/base/globals';

import tableCell from 'assets/theme/components/table/tableCell';
import tableContainer from 'assets/theme/components/table/tableContainer';
import tableHead from 'assets/theme/components/table/tableHead';

import { boxShadow, hexToRgb, linearGradient, pxToRem, rgba } from './utils';

export default createTheme({
  breakpoints: { ...breakpoints },
  palette: { ...colors },
  typography: { ...typography },
  boxShadows: { ...boxShadows },
  borders: { ...borders },
  functions: {
    boxShadow,
    hexToRgb,
    linearGradient,
    pxToRem,
    rgba,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ...globals,
        ...container,
      },
    },
    MuiButton: { ...button },
    MuiTableCell: tableCell,
    MuiTableContainer: tableContainer,
    MuiTableHead: tableHead,
  },
});
