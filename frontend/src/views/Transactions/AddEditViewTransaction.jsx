import { useState, useEffect, useMemo, useRef } from 'react'
import {
  useMatches,
  useParams,
  useNavigate,
  useLocation
} from 'react-router-dom'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { yupResolver } from '@hookform/resolvers/yup'
import { govRoles, roles } from '@/constants/roles'
import { Role } from '@/components/Role'
import { ROUTES } from '@/routes/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useAdminAdjustment,
  useCreateUpdateAdminAdjustment
} from '@/hooks/useAdminAdjustment'
import {
  useInitiativeAgreement,
  useCreateUpdateInitiativeAgreement
} from '@/hooks/useInitiativeAgreement'
import {
  useTheme,
  Stack,
  useMediaQuery,
  Step,
  StepLabel,
  Stepper
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import Loading from '@/components/Loading'
import BCAlert from '@/components/BCAlert'
import BCModal from '@/components/BCModal'
import { dateFormatter } from '@/utils/formatters'
import {
  Comments,
  TransactionDetails,
  TransactionView,
  TransactionHistory
} from '@/views/Transactions/components'
import { useQueryClient } from '@tanstack/react-query'
import { AddEditTransactionSchema } from './_schema.yup'
import { buttonClusterConfigFn } from './buttonConfigs'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import { useTransactionMutation } from './transactionMutation'
import InternalComments from '@/components/InternalComments'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT
} from '@/views/Transactions/constants'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog.jsx'
import { SupportingDocumentSummary } from '@/views/SupportingDocuments/SupportingDocumentSummary.jsx'
import { useTransactionDocuments } from '@/hooks/useTransactions.js'
import TransactionDocuments from '@/views/Transactions/components/Documents.jsx'

export const AddEditViewTransaction = () => {
  const queryClient = useQueryClient()
  const theme = useTheme()
  const isMobileSize = useMediaQuery(theme.breakpoints.down('sm'))
  const { t } = useTranslation([
    'common',
    'adminadjustment',
    'initiativeagreement',
    'transaction'
  ])
  const matches = useMatches()
  const navigate = useNavigate()
  const location = useLocation()
  const [modalData, setModalData] = useState(null)
  const mode = matches[matches.length - 1]?.handle?.mode
  const { transactionId } = useParams()
  const { hasRoles, hasAnyRole } = useCurrentUser()
  const [steps, setSteps] = useState(['Draft', 'Recommended', 'Approved'])
  const alertRef = useRef()
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [internalComment, setInternalComment] = useState('')

  const [isFileDialogOpen, setFileDialogOpen] = useState(false)

  const { handleSuccess, handleError } = useTransactionMutation(
    t,
    setAlertMessage,
    setAlertSeverity,
    setModalData,
    alertRef,
    queryClient
  )

  const {
    mutate: createUpdateAdminAdjustment,
    isLoading: isUpdatingAdminAdjustment
  } = useCreateUpdateAdminAdjustment(transactionId, {
    onSuccess: (response) =>
      handleSuccess(response, transactionId, ADMIN_ADJUSTMENT),
    onError: (error) => handleError(error, transactionId, ADMIN_ADJUSTMENT)
  })

  const {
    mutate: createUpdateInitiativeAgreement,
    isLoading: isUpdatingInitiativeAgreement
  } = useCreateUpdateInitiativeAgreement(transactionId, {
    onSuccess: (response) =>
      handleSuccess(response, transactionId, INITIATIVE_AGREEMENT),
    onError: (error) => handleError(error, transactionId, INITIATIVE_AGREEMENT)
  })

  const methods = useForm({
    resolver: yupResolver(AddEditTransactionSchema),
    mode: 'onChange',
    defaultValues: {
      txnType: '',
      toOrganizationId: null,
      complianceUnits: null,
      transactionEffectiveDate: null,
      govComment: null
    }
  })

  const {
    watch,
    setValue,
    formState: { errors },
    handleSubmit
  } = methods

  let txnType = watch('txnType')

  const handleCommentChange = (newComment) => {
    setInternalComment(newComment)
  }

  useEffect(() => {
    const path = window.location.pathname

    // Set transactionType based on URL path if not in 'add' mode
    if (mode !== 'add') {
      if (path.includes('admin-adjustment')) {
        setValue('txnType', ADMIN_ADJUSTMENT)
      } else if (path.includes('initiative-agreement')) {
        setValue('txnType', INITIATIVE_AGREEMENT)
      }
    }

    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state, mode, setValue])

  if (mode !== 'add') {
    txnType = location.pathname.includes('admin-adjustment')
      ? ADMIN_ADJUSTMENT
      : INITIATIVE_AGREEMENT
  }

  const { data: documentData, isLoading: documentsLoading } =
    useTransactionDocuments(transactionId, txnType, {
      enabled: !!transactionId && !!txnType
    })

  // Conditionally fetch data if in edit mode and txnType is set
  const transactionDataHook =
    txnType === ADMIN_ADJUSTMENT ? useAdminAdjustment : useInitiativeAgreement
  const {
    data: transactionData,
    isLoading: isTransactionDataLoading,
    isFetched,
    isLoadingError
  } = transactionDataHook(transactionId, {
    enabled: !!transactionId && !!txnType,
    retry: false,
    staleTime: 0,
    cacheTime: 0,
    keepPreviousData: false
  })

  const stateId =
    txnType === ADMIN_ADJUSTMENT ? ADMIN_ADJUSTMENT : INITIATIVE_AGREEMENT
  const queryState = queryClient.getQueryState([stateId, transactionId])

  useEffect(() => {
    if (transactionId && isFetched && transactionData) {
      methods.reset({
        txnType: transactionData.adminAdjustmentId
          ? ADMIN_ADJUSTMENT
          : INITIATIVE_AGREEMENT,
        govComment: transactionData.govComment,
        toOrganizationId: transactionData.toOrganizationId || '',
        complianceUnits: transactionData.complianceUnits || '',
        transactionEffectiveDate: transactionData.transactionEffectiveDate
          ? dateFormatter(transactionData.transactionEffectiveDate)
          : null
      })
    } else {
      queryClient.invalidateQueries([txnType, transactionId]) // Invalidate and refetch if data is not fetched
    }
    if (isLoadingError || queryState?.status === 'error') {
      setAlertMessage(
        t(`${txnType}:actionMsgs.errorRetrieval`, { transactionId })
      )
      setAlertSeverity('error')
    }
  }, [
    isFetched,
    transactionId,
    transactionData,
    isLoadingError,
    queryState,
    txnType,
    methods,
    t,
    queryClient
  ])

  const formatTransactionId = (transactionId, txnType) => {
    const prefixMap = {
      administrativeAdjustment: 'AA',
      initiativeAgreement: 'IA'
    }

    const prefix = prefixMap[txnType] || ''
    return `${prefix}${transactionId}`
  }

  const title = useMemo(() => {
    switch (mode) {
      case 'add':
        return t('txn:newTransaction')
      case 'edit':
        return `Edit ${t(`${txnType}:${txnType}`)} ${formatTransactionId(
          transactionId,
          txnType
        )}`
      default:
        return `${t(`${txnType}:${txnType}`)} ${formatTransactionId(
          transactionId,
          txnType
        )}`
    }
  }, [mode, t, transactionId, txnType])

  const currentStatus = transactionData?.currentStatus?.status
  const isDraft = currentStatus === TRANSACTION_STATUSES.DRAFT
  const isRecommended = currentStatus === TRANSACTION_STATUSES.RECOMMENDED
  const isApproved = currentStatus === TRANSACTION_STATUSES.APPROVED
  const isEditable =
    (mode === 'add' || (mode === 'edit' && isDraft)) &&
    hasAnyRole(roles.analyst, roles.director)
  const isCommentEditable =
    isEditable || (isRecommended && hasAnyRole(roles.director))

  useEffect(() => {
    const updateSteps = () => {
      // Initialize an array to collect the statuses from the transaction history
      const statusArray = []
      statusArray.push(TRANSACTION_STATUSES.DRAFT)

      // Iterate over the transaction history to collect statuses
      transactionData?.history?.forEach((item) => {
        const status =
          txnType === ADMIN_ADJUSTMENT
            ? item.adminAdjustmentStatus.status
            : item.initiativeAgreementStatus.status
        statusArray.push(status)
      })

      // Only add recommended if its not approved
      if (
        !statusArray.includes(TRANSACTION_STATUSES.RECOMMENDED) &&
        !statusArray.includes(TRANSACTION_STATUSES.APPROVED)
      ) {
        statusArray.push(TRANSACTION_STATUSES.RECOMMENDED)
      }
      if (!statusArray.includes(TRANSACTION_STATUSES.APPROVED)) {
        statusArray.push(TRANSACTION_STATUSES.APPROVED)
      }

      // Set the steps to the collected statuses ensuring to maintain their order and uniqueness
      setSteps([...new Set(statusArray)])
    }

    updateSteps()
  }, [currentStatus, transactionData, txnType])

  const buttonClusterConfig = useMemo(
    () =>
      buttonClusterConfigFn({
        transactionId,
        transactionType: txnType,
        methods,
        hasRoles,
        t,
        setModalData,
        createUpdateAdminAdjustment,
        createUpdateInitiativeAgreement,
        internalComment
      }),
    [
      transactionId,
      txnType,
      methods,
      t,
      setModalData,
      createUpdateAdminAdjustment,
      createUpdateInitiativeAgreement,
      hasRoles,
      internalComment
    ]
  )

  if (transactionId && isTransactionDataLoading)
    return <Loading message={t('txn:loadingText')} />

  // Conditional rendering for loading
  if (
    transactionId &&
    (isTransactionDataLoading || queryState?.status === 'pending')
  )
    return <Loading message={t('txn:loadingText')} />
  if (isUpdatingAdminAdjustment || isUpdatingInitiativeAgreement)
    return <Loading message={t('txn:processingText')} />

  if (isLoadingError || queryState?.status === 'error') {
    return (
      <BCAlert
        data-test="alert-box"
        severity={alertSeverity}
        dismissible={true}
        delay={10000}
      >
        {alertMessage}
      </BCAlert>
    )
  }

  return (
    <FormProvider {...methods}>
      <div>
        {alertMessage && (
          <BCAlert
            ref={alertRef}
            data-test="alert-box"
            severity={alertSeverity}
            delay={65000}
          >
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCModal
        open={!!modalData}
        onClose={() => setModalData(null)}
        data={modalData}
      />
      <BCBox>
        {/* Header section */}
        <BCTypography variant="h5" color="primary">
          {title}
        </BCTypography>
        {/* Progress bar */}
        <BCBox
          sx={{
            margin: 'auto',
            justifyContent: 'center',
            width: '60%',
            paddingY: 2
          }}
        >
          <Stepper
            activeStep={steps.indexOf(currentStatus)}
            alternativeLabel={!isMobileSize}
            orientation={isMobileSize ? 'vertical' : 'horizontal'}
          >
            {steps.map((label, index) => {
              const labelProps = {}
              if (['Refused', 'Deleted'].includes(label)) {
                labelProps.error = true
              }
              return (
                <Step
                  key={label}
                  completed={index <= steps.indexOf(currentStatus)}
                >
                  <StepLabel {...labelProps}>{label}</StepLabel>
                </Step>
              )
            })}
          </Stepper>
        </BCBox>
        {/* Transaction Details */}
        {isEditable ? (
          <TransactionDetails
            isEditable={isEditable}
            transactionId={transactionId}
          />
        ) : (
          <TransactionView transaction={transactionData} />
        )}
        {/* Comments */}
        {!(isApproved || (isRecommended && hasAnyRole(roles.analyst))) && (
          <Comments
            isEditable={isCommentEditable}
            commentField={'govComment'}
          />
        )}
        {/* Documents */}
        {isEditable && transactionId && (
          <TransactionDocuments parentType={txnType} parentID={transactionId} />
        )}
        {/* Internal Comments */}
        {transactionId && (
          <BCBox mt={4}>
            <BCTypography variant="h6" color="primary">
              {t(`txn:internalCommentsOptional`)}
            </BCTypography>
            <BCBox>
              <Role roles={govRoles}>
                <InternalComments
                  entityType={txnType}
                  entityId={transactionId ?? null}
                  onCommentChange={handleCommentChange}
                />
              </Role>
            </BCBox>
          </BCBox>
        )}
        {/* Transaction History */}
        {transactionId && (
          <TransactionHistory transactionHistory={transactionData?.history} />
        )}
        {/* Buttons */}
        <Stack
          component="div"
          direction={{ md: 'column', lg: 'row' }}
          justifyContent="flex-end"
          mt={2}
          gap={2}
          spacing={2}
        >
          <BCButton
            variant="outlined"
            color="primary"
            style={{ gap: 8 }}
            onClick={() => navigate(ROUTES.TRANSACTIONS.LIST)}
          >
            <FontAwesomeIcon icon={faArrowLeft} fontSize={8} />
            <BCTypography variant="body4" sx={{ textTransform: 'capitalize' }}>
              {t('backBtn')}
            </BCTypography>
          </BCButton>
          {buttonClusterConfig[
            transactionId ? currentStatus : TRANSACTION_STATUSES.NEW
          ]?.map(
            (config) =>
              config && (
                <Role key={config.label}>
                  <BCButton
                    id={config.id}
                    size="small"
                    variant={config.variant}
                    color={config.color}
                    onClick={handleSubmit(config.handler)}
                    startIcon={
                      config.startIcon && (
                        <FontAwesomeIcon
                          icon={config.startIcon}
                          className="small-icon"
                        />
                      )
                    }
                    disabled={config.disabled}
                  >
                    {config.label}
                  </BCButton>
                </Role>
              )
          )}
        </Stack>
      </BCBox>
      <DocumentUploadDialog
        parentID={transactionId}
        parentType={txnType}
        open={isFileDialogOpen}
        close={() => {
          setFileDialogOpen(false)
        }}
      />
    </FormProvider>
  )
}
