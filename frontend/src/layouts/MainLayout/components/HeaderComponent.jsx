import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import BCTypography from '@/components/BCTypography'
import SupplierBalance from './SupplierBalance' // Adjust the import path as necessary

export const HeaderComponent = () => {
  const { t } = useTranslation()
  const { data, isFetched } = useCurrentUser()

  return (
    isFetched && (
      <>
        <BCTypography
          className="organization_name"
          variant="body1"
          align="right"
        >
          {data?.organization?.name || t('govOrg')}
        </BCTypography>
        {data?.organization?.organizationId && <SupplierBalance />}
      </>
    )
  )
}
