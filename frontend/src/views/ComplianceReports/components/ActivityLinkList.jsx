import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, List } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { ROUTES } from '@/constants/routes'
import Chip from '@mui/material/Chip'
import { styled } from '@mui/material/styles'
import colors from '@/themes/base/colors.js'

export const StyledChip = styled(Chip)({
  fontWeight: 'bold',
  height: '26px',
  margin: '6px 8px 6px 4px',
  fontSize: '16px',
  borderRadius: '8px',
  backgroundColor: colors.nav.main
})

export const ActivityLinksList = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { compliancePeriod, complianceReportId } = useParams()

  const createActivity = (nameKey, labelKey, route) => ({
    name: t(nameKey),
    label: t(labelKey),
    action: () => {
      navigate(
        route
          .replace(':compliancePeriod', compliancePeriod)
          .replace(':complianceReportId', complianceReportId)
      )
    }
  })

  const primaryList = useMemo(
    () => [
      createActivity(
        'report:activityLists.supplyOfFuel',
        'report:activityLabels.supplyOfFuel',
        ROUTES.REPORTS_ADD_SUPPLY_OF_FUEL
      ),
      createActivity(
        'report:activityLists.notionalTransfers',
        'report:activityLabels.notionalTransfers',
        ROUTES.REPORTS_ADD_NOTIONAL_TRANSFERS
      ),
      createActivity(
        'report:activityLists.fuelsOtherUse',
        'report:activityLabels.fuelsOtherUse',
        ROUTES.REPORTS_ADD_OTHER_USE_FUELS
      ),
      createActivity(
        'report:activityLists.exportFuels',
        'report:activityLabels.exportFuels',
        ROUTES.REPORTS_ADD_FUEL_EXPORTS
      )
    ],
    [t, navigate, compliancePeriod, complianceReportId]
  )

  const secondaryList = useMemo(
    () => [
      createActivity(
        'report:activityLists.finalSupplyEquipment',
        'report:activityLabels.finalSupplyEquipment',
        ROUTES.REPORTS_ADD_FINAL_SUPPLY_EQUIPMENTS
      ),
      createActivity(
        'report:activityLists.allocationAgreements',
        'report:activityLabels.allocationAgreements',
        ROUTES.REPORTS_ADD_ALLOCATION_AGREEMENTS
      )
    ],
    [t, navigate, compliancePeriod, complianceReportId]
  )

  return (
    <>
      <BCTypography
        variant="body4"
        color="text"
        component="div"
        fontWeight="bold"
      >
        {t('report:activityLinksList')}:
      </BCTypography>
      <List
        data-test="schedule-list"
        component="div"
        sx={{ maxWidth: '100%', listStyleType: 'disc' }}
      >
        {primaryList.map((activity) => (
          <Box
            sx={{ cursor: 'pointer' }}
            component="a"
            key={activity.name}
            alignItems="flex-start"
            onClick={activity.action}
          >
            <BCTypography
              variant="subtitle2"
              color="link"
              sx={{
                textDecoration: 'underline',
                '&:hover': { color: 'info.main' }
              }}
            >
              <StyledChip color="primary" label={activity.label} />
              {activity.name}
            </BCTypography>
          </Box>
        ))}
      </List>
      <BCTypography
        variant="body4"
        fontWeight="bold"
        color="text"
        component="div"
      >
        {t('report:activitySecondList')}:
      </BCTypography>
      <List
        data-test="schedule-list"
        component="div"
        sx={{ maxWidth: '100%', listStyleType: 'disc' }}
      >
        {secondaryList.map((activity) => (
          <Box
            sx={{ cursor: 'pointer' }}
            component="a"
            key={activity.name}
            alignItems="flex-start"
            onClick={activity.action}
          >
            <BCTypography
              variant="subtitle2"
              color="link"
              sx={{
                textDecoration: 'underline',
                '&:hover': { color: 'info.main' }
              }}
            >
              <StyledChip color="primary" label={activity.label} />
              {activity.name}
            </BCTypography>
          </Box>
        ))}
      </List>
    </>
  )
}
