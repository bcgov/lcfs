import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { lcjfipBceidRoles, lcjfipIdirRoles } from '@/constants/roles'
import ROUTES from '@/routes/routes'
import withRole from '@/utils/withRole'

// Landing page for the Low carbon jet fuel incentive program (#5488).
// A placeholder for now: program content arrives in later cards.
export const LCJFIPBase = () => {
  const { t } = useTranslation(['common'])

  return (
    <BCBox>
      {/* The layout's visually hidden h1 carries the route title, so the
          visible page title is the next heading level down. */}
      <BCTypography
        variant="h5"
        component="h2"
        color="primary"
        data-test="lcjfip-title"
      >
        {t('lcjfipPageTitle')}
      </BCTypography>
    </BCBox>
  )
}

// Users without a permitted role who open the URL directly are sent to the
// dashboard, the same access-denied behaviour as the other role-gated pages.
export const LCJFIP = withRole(
  LCJFIPBase,
  [...lcjfipBceidRoles, ...lcjfipIdirRoles],
  ROUTES.DASHBOARD
)
LCJFIP.displayName = 'LCJFIP'

export default LCJFIP
