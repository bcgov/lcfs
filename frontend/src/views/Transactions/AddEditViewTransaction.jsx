import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import InternalComments from '@/components/InternalComments'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
import { govRoles, roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import {
  useAdminAdjustment,
  useCreateUpdateAdminAdjustment
} from '@/hooks/useAdminAdjustment'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useCreateUpdateInitiativeAgreement,
  useInitiativeAgreement
} from '@/hooks/useInitiativeAgreement'
import { dateFormatter } from '@/utils/formatters'
import {
  Comments,
  TransactionDetails,
  TransactionHistory,
  TransactionView
} from '@/views/Transactions/components'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT
} from '@/views/Transactions/constants'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { yupResolver } from '@hookform/resolvers/yup'
import {
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  useLocation,
  useMatches,
  useNavigate,
  useParams
} from 'react-router-dom'
import { AddEditTransactionSchema } from './_schema.yup'
import { buttonClusterConfigFn } from './buttonConfigs'
import { useTransactionMutation } from './transactionMutation'

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
    isPending: isUpdatingAdminAdjustment
  } = useCreateUpdateAdminAdjustment({
    adminAdjustmentId: transactionId ? +transactionId : undefined
  })

  const {
    mutate: createUpdateInitiativeAgreement,
    isPending: isUpdatingInitiativeAgreement
  } = useCreateUpdateInitiativeAgreement({
    initiativeAgreementId: transactionId ? +transactionId : undefined
  })

  const methods = useForm({
    resolver: yupResolver(AddEditTransactionSchema),
    mode: 'onChange',
    defaultValues: {
      txnType: '',
      transactionEffectiveDate: null
    }
  })

  const { watch, setValue, handleSubmit } = methods

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

  // Conditionally fetch data if in edit mode and txnType is set
  const transactionDataHook =
    txnType === ADMIN_ADJUSTMENT ? useAdminAdjustment : useInitiativeAgreement
  const {
    data: transactionData,
    isLoading: isTransactionDataLoading,
    isFetched,
    isLoadingError
  } = transactionDataHook(
    { adminAdjustmentId: transactionId ? +transactionId : undefined },
    {
      enabled: !!transactionId && !!txnType,
      retry: false,
      staleTime: 0
    }
  )

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

      if (!statusArray.includes(TRANSACTION_STATUSES.RECOMMENDED)) {
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
        createUpdateAdminAdjustment: (data) =>
          createUpdateAdminAdjustment(data, {
            onSuccess: (response) =>
              handleSuccess(response, transactionId, ADMIN_ADJUSTMENT),
            onError: (error) =>
              handleError(error, transactionId, ADMIN_ADJUSTMENT)
          }),
        createUpdateInitiativeAgreement: (data) =>
          createUpdateInitiativeAgreement(data, {
            onSuccess: (response) =>
              handleSuccess(response, transactionId, INITIATIVE_AGREEMENT),
            onError: (error) =>
              handleError(error, transactionId, INITIATIVE_AGREEMENT)
          }),
        internalComment
      }),
    [
      transactionId,
      txnType,
      methods,
      hasRoles,
      t,
      internalComment,
      createUpdateAdminAdjustment,
      handleSuccess,
      handleError,
      createUpdateInitiativeAgreement
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
        <Typography variant="h5" color="primary">
          {title}
        </Typography>

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

        {/* Internal Comments */}
        <BCBox mt={4}>
          <Typography variant="h6" color="primary">
            {t(`txn:internalCommentsOptional`)}
          </Typography>
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
            onClick={() => navigate(ROUTES.TRANSACTIONS)}
          >
            <FontAwesomeIcon icon={faArrowLeft} fontSize={8} />
            <Typography variant="body4" sx={{ textTransform: 'capitalize' }}>
              {t('backBtn')}
            </Typography>
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
    </FormProvider>
  )
}
