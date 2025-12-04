import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import BCTypography from '@/components/BCTypography'
import SupplierBalance from './SupplierBalance' // Adjust the import path as necessary
import { NavLink } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import BCBox from '@/components/BCBox'

export const HeaderComponent = () => {
  const { t } = useTranslation()
  const { data, isFetched } = useCurrentUser()
  const isGovernmentUser = data?.isGovernmentUser

  return (
    isFetched && (
      <BCBox
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end'
        }}
      >
        <BCTypography
          component={isGovernmentUser ? 'span' : NavLink}
          to={!isGovernmentUser ? ROUTES.ORGANIZATION.ORG : undefined}
          className="organization_name"
          variant="body1"
          align="right"
        >
          {data?.organization?.name || t('govOrg')}
        </BCTypography>
        {data?.organization?.organizationId && <SupplierBalance />}
      </BCBox>
    )
  )
}
