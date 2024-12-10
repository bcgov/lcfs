import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { List } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { ROUTES } from '@/constants/routes'
import { StyledListItem } from '@/components/StyledListItem'

export const ActivityLinksList = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { compliancePeriod, complianceReportId } = useParams()

  const activityList = useMemo(() => {
    return [
      {
        name: t('report:activityLists.supplyOfFuel'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_SUPPLY_OF_FUEL.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          )
        }
      },
      {
        name: t('report:activityLists.finalSupplyEquipment'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_FINAL_SUPPLY_EQUIPMENTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          )
        }
      },
      {
        name: t('report:activityLists.allocationAgreements'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_ALLOCATION_AGREEMENTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          )
        }
      },
      {
        name: t('report:activityLists.notionalTransfers'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_NOTIONAL_TRANSFERS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          )
        }
      },
      {
        name: t('report:activityLists.fuelsOtherUse'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_OTHER_USE_FUELS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          )
        }
      },
      {
        name: t('report:activityLists.exportFuels'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_FUEL_EXPORTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          )
        }
      }
    ]
  }, [t, navigate, compliancePeriod, complianceReportId])

  return (
    <List
      data-test="schedule-list"
      component="div"
      sx={{ maxWidth: '100%', listStyleType: 'disc' }}
    >
      {activityList.map((activity, index) => (
        <StyledListItem
          sx={{ cursor: 'pointer' }}
          component="a"
          key={index}
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
            {activity.name}
          </BCTypography>
        </StyledListItem>
      ))}
    </List>
  )
}
