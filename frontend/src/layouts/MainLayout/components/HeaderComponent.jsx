import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import BCTypography from '@/components/BCTypography'
import SupplierBalance from './SupplierBalance' // Adjust the import path as necessary
import { NavLink } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'

export const HeaderComponent = () => {
  const { t } = useTranslation()
  const { data, isFetched } = useCurrentUser()

  return (
    isFetched && (
      <>
        <BCTypography
          component={NavLink}
          to={!data?.isGovernmentUser && ROUTES.ORGANIZATION.ORG}
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
