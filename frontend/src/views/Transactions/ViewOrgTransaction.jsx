import { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAdminAdjustment } from '@/hooks/useAdminAdjustment'
import { useInitiativeAgreement } from '@/hooks/useInitiativeAgreement'
import { OrgTransactionDetails } from '@/views/Transactions/components'
import Loading from '@/components/Loading'
import BCAlert from '@/components/BCAlert'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT
} from '@/views/Transactions/constants'

export const ViewOrgTransaction = () => {
  const { t } = useTranslation([
    'common',
    'adminadjustment',
    'initiativeagreement',
    'transaction'
  ])

  // Get transaction ID from URL parameters
  const { transactionId } = useParams()

  const location = useLocation()
  const [transactionType, setTransactionType] = useState(null)

  // Effect to determine transaction type from URL
  useEffect(() => {
    const path = window.location.pathname

    // Determine the transaction type based on URL path
    if (path.includes('org-admin-adjustment')) {
      setTransactionType(ADMIN_ADJUSTMENT)
    } else if (path.includes('org-initiative-agreement')) {
      setTransactionType(INITIATIVE_AGREEMENT)
    }
  }, [location.pathname])

  // Choose the appropriate data hook based on transaction type
  const transactionDataHook =
    transactionType === ADMIN_ADJUSTMENT
      ? useAdminAdjustment
      : useInitiativeAgreement

  // Fetch transaction data
  const {
    data: transactionData,
    isLoading: isTransactionDataLoading,
    isError: isLoadingError
  } = transactionDataHook(transactionId, {
    enabled: !!transactionId && !!transactionType,
    retry: false,
    staleTime: 0,
    cacheTime: 0,
    keepPreviousData: false
  })

  // Memoized function to render transaction details based on data fetch status and type
  const renderTransactionDetails = useMemo(() => {
    if (isTransactionDataLoading) {
      return <Loading message={t('txn:loadingText')} />
    }

    if (isLoadingError) {
      return (
        <BCAlert severity="error" dismissible={true}>
          {t(`${transactionType}:actionMsgs.errorRetrieval`)}
        </BCAlert>
      )
    }

    if (!transactionData) {
      return null
    }

    return (
      <OrgTransactionDetails
        transactionType={transactionType}
        transactionData={transactionData}
      />
    )
  }, [
    transactionType,
    transactionId,
    isTransactionDataLoading,
    isLoadingError,
    transactionData,
    t
  ])

  return (
    <>
      {/* Render transaction details based on current state */}
      {renderTransactionDetails}
    </>
  )
}

export default ViewOrgTransaction
