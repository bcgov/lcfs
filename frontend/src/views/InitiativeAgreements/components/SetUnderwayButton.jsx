import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { INITIATIVE_AGREEMENT_LIFECYCLE_STATUSES } from '@/constants/statuses'
import { useSetAgreementUnderway } from '@/hooks/useInitiativeAgreements'

// A Director releases a completed draft package to its organization (#5553).
// The API enforces the role, the Draft status and the organization too; this
// only decides whether to offer the action. An agreement with no
// organization has nobody to release it to, so it is not offered then.
export const SetUnderwayButton = ({ agreement, onSuccess, onError }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [open, setOpen] = useState(false)
  const { mutateAsync } = useSetAgreementUnderway(
    agreement.initiativeAgreementId
  )

  if (
    agreement.lifecycleStatus?.status !==
      INITIATIVE_AGREEMENT_LIFECYCLE_STATUSES.DRAFT ||
    !agreement.organization
  ) {
    return null
  }

  const confirm = async () => {
    try {
      const updated = await mutateAsync()
      setOpen(false)
      onSuccess?.(updated)
    } catch (error) {
      setOpen(false)
      onError?.(error)
    }
  }

  return (
    <Role roles={[roles.director]}>
      <BCBox
        mt={3}
        sx={{ display: 'flex', justifyContent: 'flex-end' }}
        data-test="set-underway-section"
      >
        <BCButton
          type="button"
          variant="contained"
          color="primary"
          data-test="set-underway-button"
          onClick={() => setOpen(true)}
        >
          {t('initiativeAgreement:setUnderway.button')}
        </BCButton>
      </BCBox>
      <BCModal
        open={open}
        onClose={() => setOpen(false)}
        data={{
          title: t('initiativeAgreement:setUnderway.title'),
          content: (
            <BCTypography
              variant="body4"
              component="p"
              data-test="set-underway-message"
            >
              {t('initiativeAgreement:setUnderway.message')}
            </BCTypography>
          ),
          primaryButtonText: t('initiativeAgreement:setUnderway.confirm'),
          primaryButtonAction: confirm,
          secondaryButtonText: t('common:cancelBtn')
        }}
      />
    </Role>
  )
}
