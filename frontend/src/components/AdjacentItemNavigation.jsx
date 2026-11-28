import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import BCTypography from '@/components/BCTypography'

const navButtonSx = {
  backgroundColor: '#003366',
  color: 'white !important',
  borderRadius: '50%',
  width: 25,
  height: 25,
  padding: 0,
  '& .MuiSvgIcon-root': {
    color: 'white',
    fontSize: '18px !important'
  },
  '&:hover': {
    backgroundColor: '#004080',
    '& .MuiSvgIcon-root': { color: 'white' }
  },
  '&.Mui-disabled': {
    backgroundColor: '#c0c0c0',
    color: '#808080'
  }
}

/** Shared circular controls for navigating adjacent records. */
export const AdjacentItemNavigation = ({
  currentLabel,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  previousTooltip = '',
  nextTooltip = '',
  previousAriaLabel,
  nextAriaLabel,
  testIdPrefix = 'adjacent-item-navigation',
  previousTestId,
  nextTestId,
  currentTestId,
  currentLabelVariant = 'body4',
  currentLabelSx = {},
  gap = 1,
  containerSx = {}
}) => (
  <Box
    data-test={testIdPrefix}
    sx={{ display: 'inline-flex', alignItems: 'center', gap, ...containerSx }}
  >
    <Tooltip title={previousTooltip} placement="top" arrow>
      <span>
        <IconButton
          data-test={previousTestId || `${testIdPrefix}-previous`}
          aria-label={previousAriaLabel}
          size="small"
          onClick={onPrevious}
          disabled={previousDisabled}
          sx={navButtonSx}
        >
          <ChevronLeft />
        </IconButton>
      </span>
    </Tooltip>
    <BCTypography
      variant={currentLabelVariant}
      component="span"
      data-test={currentTestId || `${testIdPrefix}-current`}
      sx={currentLabelSx}
    >
      {currentLabel}
    </BCTypography>
    <Tooltip title={nextTooltip} placement="top" arrow>
      <span>
        <IconButton
          data-test={nextTestId || `${testIdPrefix}-next`}
          aria-label={nextAriaLabel}
          size="small"
          onClick={onNext}
          disabled={nextDisabled}
          sx={navButtonSx}
        >
          <ChevronRight />
        </IconButton>
      </span>
    </Tooltip>
  </Box>
)

export default AdjacentItemNavigation
