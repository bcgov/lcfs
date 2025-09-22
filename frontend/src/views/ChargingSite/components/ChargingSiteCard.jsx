import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useCallback, useRef, useState } from 'react'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { ChargingSiteProfile } from './ChargingSiteProfile'
import BCBox from '@/components/BCBox'
import { govRoles, roles } from '@/constants/roles'
import Loading from '@/components/Loading'
import ROUTES from '@/routes/routes'
import { Grid2 } from '@mui/material'
import ChargingSitesMap from './ChargingSitesMap'
import { AddEditChargingSite } from '../AddEditChargingSite'
import BCButton from '@/components/BCButton'

export const ChargingSiteCard = ({
  addMode = false,
  data,
  hasAnyRole,
  hasRoles,
  isIDIR,
  refetch
}) => {
  const alertRef = useRef(null)
  const { t } = useTranslation('chargingSite')
  const [isEditMode, setIsEditMode] = useState(addMode)
  const { siteId } = useParams()

  const canEdit = hasRoles(roles.supplier) && data.status.status === 'Draft'
  const editButtonRoute = canEdit
    ? ROUTES.REPORTS.CHARGING_SITE.EDIT.replace(':siteId', siteId)
    : null

  const handleEditClick = useCallback(() => {
    setIsEditMode(true)
  }, [])

  return (
    <BCBox sx={{ mt: 4, mb: -1 }}>
      <Grid2 container spacing={1}>
        {/* Card Section - 7 parts (58.33%) */}
        <Grid2 size={{ xs: 12, md: isEditMode ? 12 : 7 }}>
          <BCWidgetCard
            title={t('cardTitle')}
            color="nav"
            editButton={
              canEdit && !isEditMode
                ? {
                    text: t('common:editBtn'),
                    onClick: handleEditClick,
                    id: 'edit-charging-site-button'
                  }
                : undefined
            }
            content={
              isEditMode ? (
                <>
                  <AddEditChargingSite
                    isEditMode={isEditMode}
                    setIsEditMode={setIsEditMode}
                    data={data}
                    refetch={refetch}
                  />
                </>
              ) : (
                <ChargingSiteProfile data={data} />
              )
            }
          />
        </Grid2>

        {/* Map Section - 3 parts (25%) */}
        {!isEditMode && (
          <Grid2 size={{ xs: 12, md: 5 }}>
            <BCBox sx={{ height: '100%' }}>
              <ChargingSitesMap
                sites={[data]}
                showLegend={false}
                height="87%"
              />
            </BCBox>
          </Grid2>
        )}
      </Grid2>
    </BCBox>
  )
}
