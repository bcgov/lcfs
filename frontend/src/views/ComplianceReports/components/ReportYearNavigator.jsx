import ROUTES from '@/routes/routes'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import AdjacentItemNavigation from '@/components/AdjacentItemNavigation'

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
    <AdjacentItemNavigation
      currentLabel={currentCompliancePeriod}
      currentLabelVariant="h5"
      currentLabelSx={{
        minWidth: '3.5rem',
        textAlign: 'center',
        color: '#003366',
        fontWeight: 'bold'
      }}
      onPrevious={() => goTo(previous)}
      onNext={() => goTo(next)}
      previousDisabled={previousDisabled}
      nextDisabled={nextDisabled}
      previousTooltip={previousTooltip}
      nextTooltip={nextTooltip}
      previousAriaLabel={t('report:yearNavigator.previous')}
      nextAriaLabel={t('report:yearNavigator.next')}
      testIdPrefix="report-year-navigator"
      gap={2}
      containerSx={{ display: 'inline-flex' }}
    />
  )
}

ReportYearNavigator.propTypes = {
  currentCompliancePeriod: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]).isRequired,
  previous: PropTypes.shape({
    complianceReportId: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    compliancePeriod: PropTypes.string
  }),
  next: PropTypes.shape({
    complianceReportId: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    compliancePeriod: PropTypes.string
  }),
  isLoading: PropTypes.bool
}

export default ReportYearNavigator
