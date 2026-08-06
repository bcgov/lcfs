import Loading from '@/components/Loading'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'

import { CreditLedgerLegacy } from './CreditLedgerLegacy'
import { CreditLedgerPeriod } from './CreditLedgerPeriod'

/**
 * Credit ledger entry point.
 *
 * The compliance-period ledger (#4714) is rolled out to IDIR users first so it
 * can be exercised internally in production; BCeID suppliers stay on the
 * previous all-time grid until it is released to them.
 */
export const CreditLedger = ({ organizationId }) => {
  const { hasRoles, isLoading } = useCurrentUser()

  // Wait for the user before choosing, otherwise suppliers would briefly see
  // the period ledger while roles are still loading.
  if (isLoading) {
    return <Loading />
  }

  return hasRoles(roles.government) ? (
    <CreditLedgerPeriod organizationId={organizationId} />
  ) : (
    <CreditLedgerLegacy organizationId={organizationId} />
  )
}
