import { useTranslation } from 'react-i18next'
import { useCallback, useRef, useState } from 'react'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { ChargingSiteProfile } from './ChargingSiteProfile'
import BCBox from '@/components/BCBox'
import { roles } from '@/constants/roles'
import { Divider, FormControlLabel, Grid2, Switch } from '@mui/material'
import ChargingSitesMap from './ChargingSitesMap'
import { AddEditChargingSite } from '../AddEditChargingSite'

export const ChargingSiteCard = ({
  addMode = false,
  data,
  hasAnyRole,
  hasRoles,
  historyMode = false,
  isIDIR,
  onHistoryModeChange,
  refetch,
  alertRef: alertRefProp
}) => {
  const localAlertRef = useRef(null)
  const alertRef = alertRefProp ?? localAlertRef
  const { t } = useTranslation('chargingSite')
  const [isEditMode, setIsEditMode] = useState(addMode)

  const canEdit =
    !historyMode && hasRoles(roles.supplier) && data.status.status != 'Submitted'

  const handleEditClick = useCallback(() => {
    setIsEditMode(true)
  }, [])

  const siteHistory = historyMode
    ? data?.history?.length
      ? data.history
      : [data]
    : []

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
                <BCBox>
                  <BCBox sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={historyMode}
                          onChange={(event) =>
                            onHistoryModeChange?.(event.target.checked)
                          }
                          inputProps={{ 'aria-label': t('historyToggle') }}
                        />
                      }
                      label={t('historyToggle')}
                      sx={{ mr: 0 }}
                    />
                  </BCBox>
                  {historyMode ? (
                    <BCBox
                      sx={{
                        maxHeight: 520,
                        overflowY: 'auto',
                        pr: 1
                      }}
                    >
                      {siteHistory.map((siteVersion, index) => (
                        <BCBox key={siteVersion.chargingSiteId}>
                          <ChargingSiteProfile
                            data={siteVersion}
                            hasAnyRole={hasAnyRole}
                            hasRoles={hasRoles}
                            historyMode={historyMode}
                            isIDIR={isIDIR}
                            refetch={refetch}
                            alertRef={alertRef}
                          />
                          {index < siteHistory.length - 1 && (
                            <Divider sx={{ my: 1.5 }} />
                          )}
                        </BCBox>
                      ))}
                    </BCBox>
                  ) : (
                    <ChargingSiteProfile
                      data={data}
                      hasAnyRole={hasAnyRole}
                      hasRoles={hasRoles}
                      historyMode={historyMode}
                      isIDIR={isIDIR}
                      refetch={refetch}
                      alertRef={alertRef}
                    />
                  )}
                </BCBox>
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
