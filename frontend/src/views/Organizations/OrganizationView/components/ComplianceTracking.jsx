import React from 'react'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'

export const ComplianceTracking = () => {
  const { t } = useTranslation(['org'])

  return (
    <BCBox p={2}>
      <BCTypography variant="h5" color="primary" sx={{ mb: 2 }}>
        {t('org:sections.complianceTracking.title')}
      </BCTypography>
      <BCTypography variant="body1" color="text.secondary">
        {t('org:sections.complianceTracking.description')}
      </BCTypography>
    </BCBox>
  )
}

export default ComplianceTracking
