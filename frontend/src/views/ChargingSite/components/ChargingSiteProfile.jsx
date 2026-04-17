import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { createStatusRenderer } from '@/utils/grid/cellRenderers'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import BCButton from '@/components/BCButton'
import { useUpdateChargingSiteStatus } from '@/hooks/useChargingSite'

export const ChargingSiteProfile = ({
  alertRef = useRef(null),
  data,
  hasAnyRole,
  hasRoles,
  historyMode = false,
  isIDIR,
  refetch
}) => {
  const { t } = useTranslation('chargingSite')
  const { siteId } = useParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const updateStatusMutation = useUpdateChargingSiteStatus({
    onSuccess: () => {
      refetch?.()
      alertRef?.current?.triggerAlert?.({
        message: t('messages.statusUpdateSuccess'),
        severity: 'success'
      })
    },
    onError: (err) => {
      const message =
        err?.response?.data?.detail || err?.message || t('messages.statusUpdateError')
      alertRef?.current?.triggerAlert?.({ message, severity: 'error' })
    }
  })

  const currentStatus = data?.status?.status || ''
  const isBCeIDCompliance =
    hasAnyRole?.(roles.compliance_reporting, roles.signing_authority) ?? false
  const isAnalyst = hasAnyRole?.(roles.analyst) ?? false

  // IDIR Analyst only: show "Set as validated" when site is Submitted (backend enforces Analyst)
  const canSetValidated =
    !historyMode && isIDIR && isAnalyst && currentStatus === 'Submitted'
  // BCeID: show "Submit updates" for Compliance Reporting/Signing Authority only when Updated
  const canSubmitSite =
    !historyMode && !isIDIR && isBCeIDCompliance && currentStatus === 'Updated'

  const handleSetValidated = () => {
    if (!canSetValidated || !siteId) return
    setIsSubmitting(true)
    updateStatusMutation.mutate(
      { siteId, newStatus: 'Validated' },
      {
        onSettled: () => setIsSubmitting(false)
      }
    )
  }

  const handleSubmitSite = () => {
    if (!canSubmitSite || !siteId) return
    setIsSubmitting(true)
    updateStatusMutation.mutate(
      { siteId, newStatus: 'Submitted' },
      {
        onSettled: () => setIsSubmitting(false)
      }
    )
  }

  const { streetAddress, city, postalCode } = data
  return (
    <BCBox p={1}>
      <BCTypography variant="h6" color="primary">
        {data?.siteName || ''}
      </BCTypography>
      <BCBox
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: '1fr 3fr' }}
        columnGap={10}
        rowGap={2}
        mt={1}
      >
        {/* Left Column */}
        <BCBox display="flex" flexDirection="column" gap={1}>
          <BCBox sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BCTypography variant="label">
              {t('cardLabels.status')}:
            </BCTypography>{' '}
            {createStatusRenderer(
              {
                Draft: 'info',
                Updated: 'info',
                Submitted: 'warning',
                Validated: 'success',
                Decommissioned: 'error'
              },
              {},
              data?.status?.status || ''
            )({ data })}
          </BCBox>

          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.version')}:
            </BCTypography>{' '}
            {String(data?.version) || ''}
          </BCTypography>

          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.siteNum')}:
            </BCTypography>{' '}
            {data?.siteCode || ''}
          </BCTypography>
        </BCBox>

        {/* Right Column */}
        <BCBox display="flex" flexDirection="column" gap={0}>
          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.siteAddr')}:
            </BCTypography>{' '}
            {[streetAddress, city, postalCode].join(', ')}
          </BCTypography>

          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.notes')}:
            </BCTypography>{' '}
            {data?.notes}
          </BCTypography>
        </BCBox>
      </BCBox>

      <Role roles={[roles.government]}>
        <BCTypography variant="body4" sx={{ mt: 1 }}>
          <BCTypography variant="label">
            {t('cardLabels.organization')}:
          </BCTypography>{' '}
          {data?.organization?.name || ''}
        </BCTypography>
      </Role>

      {(canSetValidated || canSubmitSite) && (
        <BCBox sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          {canSetValidated && (
            <BCButton
              variant="outlined"
              color="primary"
              onClick={handleSetValidated}
              disabled={isSubmitting || updateStatusMutation.isPending}
              data-test="set-charging-site-validated-button"
            >
              {t('buttons.setAsValidated')}
            </BCButton>
          )}
          {canSubmitSite && (
            <BCButton
              variant="outlined"
              color="primary"
              onClick={handleSubmitSite}
              disabled={isSubmitting || updateStatusMutation.isPending}
              data-test="submit-charging-site-button"
            >
              {t('buttons.submitUpdates')}
            </BCButton>
          )}
        </BCBox>
      )}
    </BCBox>
  )
}
