import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAdminAdjustment } from '@/hooks/useAdminAdjustment'
import { useInitiativeAgreement } from '@/hooks/useInitiativeAgreement'
import { OrgTransactionDetails } from '@/views/Transactions/components'
import Loading from '@/components/Loading'
import { FloatingAlert } from '@/components/BCAlert'
import BCTypography from '@/components/BCTypography'
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
  const alertRef = useRef()

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
    isError: isLoadingError,
    error
  } = transactionDataHook({
    adminAdjustmentId: +transactionId
  })

  useEffect(() => {
    if (isLoadingError) {
      alertRef.current?.triggerAlert({
        message: error.response?.data?.detail || error.message,
        severity: 'error'
      })
    }
  }, [isLoadingError, error])

  // Memoized function to render transaction details based on data fetch status and type
  const renderTransactionDetails = useMemo(() => {
    if (isTransactionDataLoading) {
      return <Loading message={t('txn:loadingText')} />
    }

    if (isLoadingError) {
      return (
        <>
          <FloatingAlert ref={alertRef} data-test="alert-box" delay={10000} />
          <BCTypography color="error">
            {t(`${transactionType}:actionMsgs.errorRetrieval`)}
          </BCTypography>
        </>
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
