import React from 'react'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'

export const ComplianceTracking = () => {
  const { t } = useTranslation(['org'])

  return (
    <BCBox py={0}>
      <BCTypography variant="body1" color="text.secondary">
        {t('org:sections.complianceTracking.description')}
      </BCTypography>
    </BCBox>
  )
}

export default ComplianceTracking
