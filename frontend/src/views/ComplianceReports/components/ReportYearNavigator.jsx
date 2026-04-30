import BCTypography from '@/components/BCTypography'
import ROUTES from '@/routes/routes'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { Box, IconButton, Tooltip } from '@mui/material'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

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

/**
 * Year navigation with arrows, disabled if no adjacent report.
 */
export const ReportYearNavigator = ({
  currentCompliancePeriod,
  previous,
  next,
  isLoading = false
}) => {
  const { t } = useTranslation(['report'])
  const navigate = useNavigate()

  const goTo = (target) => {
    if (!target?.complianceReportId || !target?.compliancePeriod) {
      return
    }
    navigate(
      ROUTES.REPORTS.VIEW.replace(
        ':compliancePeriod',
        target.compliancePeriod
      ).replace(':complianceReportId', target.complianceReportId)
    )
  }

  const previousDisabled = isLoading || !previous?.complianceReportId
  const nextDisabled = isLoading || !next?.complianceReportId

  const previousTooltip = previous?.compliancePeriod
    ? t('report:yearNavigator.previousYear', {
        year: previous.compliancePeriod
      })
    : t('report:yearNavigator.noPrevious')

  const nextTooltip = next?.compliancePeriod
    ? t('report:yearNavigator.nextYear', { year: next.compliancePeriod })
    : t('report:yearNavigator.noNext')

  return (
    <Box
      data-test="report-year-navigator"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
    >
      <Tooltip title={previousTooltip} placement="top" arrow>
        <span>
          <IconButton
            data-test="report-year-navigator-previous"
            aria-label={t('report:yearNavigator.previous')}
            size="small"
            onClick={() => goTo(previous)}
            disabled={previousDisabled}
            sx={navButtonSx}
          >
            <ChevronLeft />
          </IconButton>
        </span>
      </Tooltip>
      <BCTypography
        variant="h5"
        component="span"
        data-test="report-year-navigator-current"
        sx={{ minWidth: '3.5rem', textAlign: 'center', color: '#003366', fontWeight: 'bold' }}
      >
        {currentCompliancePeriod}
      </BCTypography>
      <Tooltip title={nextTooltip} placement="top" arrow>
        <span>
          <IconButton
            data-test="report-year-navigator-next"
            aria-label={t('report:yearNavigator.next')}
            size="small"
            onClick={() => goTo(next)}
            disabled={nextDisabled}
            sx={navButtonSx}
          >
            <ChevronRight />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  )
}

ReportYearNavigator.propTypes = {
  currentCompliancePeriod: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]).isRequired,
  previous: PropTypes.shape({
    complianceReportId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    compliancePeriod: PropTypes.string
  }),
  next: PropTypes.shape({
    complianceReportId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    compliancePeriod: PropTypes.string
  }),
  isLoading: PropTypes.bool
}

export default ReportYearNavigator
