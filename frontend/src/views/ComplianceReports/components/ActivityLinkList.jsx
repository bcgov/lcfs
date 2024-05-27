import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { List, ListItemButton } from '@mui/material'
import BCTypography from '@/components/BCTypography'

export const ActivityLinksList = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { compliancePeriod, reportID } = useParams()
  // reports activities
  const activityList = useMemo(() => {
    return [
      {
        name: t('report:activityLists.supplyOfFuel'),
        action: () => {
          navigate(`/reports/${compliancePeriod}/${reportID}/supply-of-fuel`)
        }
      },
      {
        name: t('report:activityLists.finalSupplyEquipment'),
        action: () => {
          navigate(`/reports/${compliancePeriod}/${reportID}/fse`)
        }
      },
      {
        name: t('report:activityLists.allocationAgreements'),
        action: () => {
          navigate(
            `/reports/${compliancePeriod}/${reportID}/allocation-agreements`
          )
        }
      },
      {
        name: t('report:activityLists.notionalTransfers'),
        action: () => {
          navigate(
            `/reports/${compliancePeriod}/${reportID}/notional-transfers`
          )
        }
      },
      {
        name: t('report:activityLists.fuelsOtherUse'),
        action: () => {
          navigate(`/reports/${compliancePeriod}/${reportID}/fuels-other-use`)
        }
      },
      {
        name: t('report:activityLists.exportFuels'),
        action: () => {
          navigate(`/reports/${compliancePeriod}/${reportID}/fuel-exports`)
        }
      }
    ]
  }, [compliancePeriod, reportID, navigate, t])

  return (
    <List component="div" sx={{ maxWidth: '100%', listStyleType: 'disc' }}>
      {activityList.map((activity, index) => (
        <ListItemButton
          sx={{ display: 'list-item', padding: '0', marginLeft: '4rem' }}
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
        </ListItemButton>
      ))}
    </List>
  )
}
