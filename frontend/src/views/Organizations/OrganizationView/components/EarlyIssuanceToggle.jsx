import { useCallback, useRef, useState } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import { useTranslation } from 'react-i18next'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { FloatingAlert } from '@/components/BCAlert'
import { getCurrentEarlyIssuanceYear } from '@/constants/common'
import { useUpdateOrganizationEarlyIssuance } from '@/hooks/useOrganization'
import { SettingRow } from './SettingRow'
import { compactRadioProps } from './fieldLayout'

/**
 * Early issuance setting shown on the organization details card.
 *
 * Everyone who can see the card sees the current value; only users who may
 * edit it (Compliance Manager / Director) get an enabled control. Changing the
 * value never saves directly: the user must confirm in a modal first. The API
 * enforces the same role restriction independently of this UI.
 */
export const EarlyIssuanceToggle = ({ orgID, hasEarlyIssuance, canEdit }) => {
  const { t } = useTranslation(['common', 'org'])
  const alertRef = useRef(null)
  const [pendingValue, setPendingValue] = useState(null)
  const year = getCurrentEarlyIssuanceYear()
  const currentValue = !!hasEarlyIssuance

  const { mutateAsync } = useUpdateOrganizationEarlyIssuance(orgID)

  const handleChange = useCallback(
    (event) => {
      const next = event.target.value === 'yes'
      if (next !== currentValue) {
        setPendingValue(next)
      }
    },
    [currentValue]
  )

  const handleCancel = useCallback(() => setPendingValue(null), [])

  const handleConfirm = useCallback(async () => {
    const value = pendingValue
    try {
      await mutateAsync(value)
      alertRef.current?.triggerAlert({
        message: t('org:earlyIssuanceUpdateSuccess'),
        severity: 'success'
      })
    } catch (error) {
      alertRef.current?.triggerAlert({
        message:
          error?.response?.data?.detail || t('org:earlyIssuanceUpdateError'),
        severity: 'error'
      })
    } finally {
      setPendingValue(null)
    }
  }, [mutateAsync, pendingValue, t])

  const labelId = 'early-issuance-label'

  return (
    <>
      <FloatingAlert ref={alertRef} data-test="early-issuance-alert" />
      <SettingRow
        label={t('org:earlyIssuanceIndicator', { year })}
        labelId={labelId}
        data-test="early-issuance-toggle"
      >
        {canEdit ? (
          <RadioGroup
            row
            name="hasEarlyIssuance"
            aria-labelledby={labelId}
            value={currentValue ? 'yes' : 'no'}
            onChange={handleChange}
          >
            <FormControlLabel
              value="no"
              control={
                <Radio {...compactRadioProps} data-test="hasEarlyIssuanceNo" />
              }
              label={
                <BCTypography variant="body4">{t('common:no')}</BCTypography>
              }
            />
            <FormControlLabel
              value="yes"
              sx={{ ml: 2 }}
              control={
                <Radio {...compactRadioProps} data-test="hasEarlyIssuanceYes" />
              }
              label={
                <BCTypography variant="body4">{t('common:yes')}</BCTypography>
              }
            />
          </RadioGroup>
        ) : (
          <BCTypography variant="body4" data-test="early-issuance-value">
            {currentValue ? t('common:yes') : t('common:no')}
          </BCTypography>
        )}
      </SettingRow>
      {canEdit && (
        <BCModal
          open={pendingValue !== null}
          onClose={handleCancel}
          data={{
            title: t('org:earlyIssuanceConfirmTitle'),
            content: (
              <BCTypography variant="body2" data-test="early-issuance-confirm">
                {t(
                  pendingValue
                    ? 'org:earlyIssuanceConfirmEnable'
                    : 'org:earlyIssuanceConfirmDisable',
                  { year }
                )}
              </BCTypography>
            ),
            primaryButtonText: t('common:saveBtn'),
            primaryButtonAction: handleConfirm,
            secondaryButtonText: t('common:cancelBtn'),
            secondaryButtonAction: handleCancel
          }}
        />
      )}
    </>
  )
}
