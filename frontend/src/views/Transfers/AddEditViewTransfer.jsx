// react and npm library components
import { useEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  useLocation,
  useMatches,
  useNavigate,
  useParams
} from 'react-router-dom'
// constants
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { TRANSACTIONS } from '@/constants/routes/routes'
import { TRANSFER_STATUSES } from '@/constants/statuses'
// hooks
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCurrentOrgBalance, useRegExtOrgs } from '@/hooks/useOrganization'
import { useCreateUpdateTransfer, useTransfer } from '@/hooks/useTransfer'
import { yupResolver } from '@hookform/resolvers/yup'

// icons and related components
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// mui components
import {
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
// reusable custom mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
// sub components
import { dateFormatter } from '@/utils/formatters'
import {
  AgreementDate,
  Comments,
  TransferDetails,
  TransferGraphic,
  TransferView
} from '@/views/Transfers/components'
import { useQueryClient } from '@tanstack/react-query'
import { AddEditTransferSchema } from './_schema'
import { buttonClusterConfigFn } from './buttonConfigs'
import { CategoryCheckbox } from './components/CategoryCheckbox'
import { Recommendation } from './components/Recommendation'
import SigningAuthority from './components/SigningAuthority'

export const AddEditViewTransfer = () => {
  const queryClient = useQueryClient()
  const theme = useTheme()
  const isMobileSize = useMediaQuery(theme.breakpoints.down('sm'))
  const [modalData, setModalData] = useState(null)
  const { t } = useTranslation(['common', 'transfer'])
  const navigate = useNavigate()
  const matches = useMatches()
  const mode = matches[matches.length - 1]?.handle?.mode
  const location = useLocation()
  const { transferId } = useParams()
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [steps, setSteps] = useState(['Draft', 'Sent', 'Submitted', 'Recorded'])
  const [refreshBalanceTrigger, setRefreshBalanceTrigger] = useState(false)
  // Fetch current user details
  const { data: currentUser, hasRoles, hasAnyRole } = useCurrentUser()
  const { data: toOrgData } = useRegExtOrgs()
  const isGovernmentUser = currentUser?.isGovernmentUser
  const currentUserOrgId = currentUser?.organization?.organizationId
  const alertRef = useRef()

  const methods = useForm({
    resolver: yupResolver(AddEditTransferSchema),
    mode: 'onChange',
    defaultValues: {
      fromOrganizationId: currentUser?.organization?.organizationId,
      agreementDate: '',
      toOrganizationId: null,
      quantity: null,
      pricePerUnit: null,
      signingAuthorityDeclaration: false,
      fromOrgComment: '',
      toOrgComment: '',
      govComment: '',
      recommendation: null
    }
  })

  // Fetch the transfer details
  const {
    data: transferData,
    isLoading: isTransferDataLoading,
    isFetched,
    isLoadingError
  } = useTransfer(transferId, {
    enabled: !!transferId,
    retry: false,
    staleTime: 0,
    keepPreviousData: false
  })

  const queryState = queryClient.getQueryState(['transfer', transferId])
  const editorMode =
    ['edit', 'add'].includes(mode) &&
    hasRoles(roles.transfers) &&
    (currentUser.organization?.organizationId ===
      transferData?.fromOrganization?.organizationId ||
      mode === 'add')

  const { refetch } = useCurrentOrgBalance({
    enabled: false // Initially, do not automatically run the query
  })
  // useEffect to listen for changes to refreshBalanceTrigger
  useEffect(() => {
    // When refreshBalanceTrigger changes, call refetch to refresh org balance
    refetch()
  }, [refreshBalanceTrigger, refetch])

  /**
   * Fetches and populates the form with existing transfer data for editing.
   * This effect runs when `transferId` changes, indicating an edit mode where an existing transfer
   * is loaded. It fetches the transfer data using the provided `transferId`, and then resets the form
   * fields with the fetched data, formatting and handling null values appropriately.
   * In case of an error during the fetch operation, it logs the error to the console.
   */
  useEffect(() => {
    if (!transferId) return
    if (isFetched && transferData) {
      // Populate the form with fetched transfer data
      methods.reset({
        fromOrganizationId: transferData.fromOrganization.organizationId,
        toOrganizationId: transferData.toOrganization.organizationId,
        quantity: transferData.quantity,
        pricePerUnit: transferData.pricePerUnit,
        fromOrgComment: transferData.fromOrgComment,
        toOrgComment: transferData.toOrgComment,
        govComment: transferData.govComment,
        agreementDate: transferData.agreementDate
          ? dateFormatter(transferData.agreementDate)
          : new Date().toISOString().split('T')[0], // Format date or use current date as fallback
        recommendation: transferData.recommendation,
        signingAuthorityDeclaration: methods.getValues().signingAuthorityDeclaration ?? false
      })
    }
    if (isLoadingError || queryState.status === 'error') {
      setAlertMessage(
        t('transfer:actionMsgs.errorRetrieval', {
          transferId
        })
      )
      setAlertSeverity('error')
    }
  }, [isFetched, transferId, isLoadingError, transferData, queryState, methods, t])

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  // update status for the transfer via mutation function.
  const {
    mutate: createUpdateTransfer,
    isLoading: isUpdatingTransfer,
    isError: isUpdateTransferError
  } = useCreateUpdateTransfer(currentUserOrgId, transferId, {
    onSuccess: (response, variables) => {
      setModalData(null)
      if (response.data.currentStatus.status === TRANSFER_STATUSES.DRAFT) {
        navigate(
          ROUTES.TRANSFERS_EDIT.replace(
            ':transferId',
            response.data.transferId
          ),
          {
            state: {
              message: t(
                `transfer:actionMsgs.${
                  transferId ? 'updatedText' : 'createdText'
                }`
              ),
              severity: 'success'
            }
          }
        )
      } else if (
        transferData?.currentStatus?.status ===
        response.data.currentStatus.status
      ) {
        setAlertMessage(
          t('transfer:actionMsgs.successText', { status: 'saved' })
        )
        setAlertSeverity('success')
      } else {
        // Refresh the org balance before we redirect to the transactions page
        // this way the balance in the header will be correct
        setRefreshBalanceTrigger((prev) => !prev)
        // Navigate to the transactions list view
        navigate(TRANSACTIONS + `/?hid=transfer-${response.data.transferId}`, {
          state: {
            message: t('transfer:actionMsgs.successText', {
              status: response.data.currentStatus.status.toLowerCase()
            }),
            severity: 'success'
          }
        })
      }
      alertRef.current.triggerAlert()
    },
    onError: (_error, _variables) => {
      setModalData(null)
      const errorMsg = _error.response.data?.detail
      if (errorMsg) {
        setAlertMessage(errorMsg)
      } else {
        setAlertMessage(
          transferId
            ? t('transfer:actionMsgs.errorUpdateText')
            : t('transfer:actionMsgs.errorCreateText')
        )
      }
      setAlertSeverity('error')
      alertRef.current.triggerAlert()
      // Scroll back to the top of the page
      window.scrollTo(0, 0)
    }
  })

  const currentStatus = transferData?.currentStatus.status

  const {
    currentStatus: { status: transferStatus } = {},
    toOrganization: { organizationId: toOrgId } = {},
    fromOrganization: { organizationId: fromOrgId } = {}
  } = transferData || {}

  useEffect(() => {
    const statusSet = new Set()
    transferData?.transferHistory?.forEach((item) => {
      statusSet.add(item.transferStatus.status)
    })
    if (statusSet.length === 0) {
      setSteps(['Draft', 'Sent', 'Submitted', 'Recorded'])
    } else {
      if (!statusSet.has(TRANSFER_STATUSES.SENT))
        statusSet.add(TRANSFER_STATUSES.SENT)
      if (
        !statusSet.has(TRANSFER_STATUSES.SUBMITTED) &&
        !statusSet.has(TRANSFER_STATUSES.DECLINED)
      )
        statusSet.add(TRANSFER_STATUSES.SUBMITTED)
      if (!statusSet.has(TRANSFER_STATUSES.RECOMMENDED) && isGovernmentUser) {
        statusSet.add(TRANSFER_STATUSES.RECOMMENDED)
      }
      if (
        !statusSet.has(TRANSFER_STATUSES.REFUSED) &&
        currentStatus !== TRANSFER_STATUSES.RECORDED
      ) {
        statusSet.add(TRANSFER_STATUSES.RECORDED)
      }
      setSteps(Array.from(statusSet))
    }
  }, [currentStatus, isGovernmentUser, transferData])

  const buttonClusterConfig = useMemo(
    () =>
      buttonClusterConfigFn({
        transferId,
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser
      }),
    [
      transferId,
      toOrgData,
      hasRoles,
      hasAnyRole,
      currentUser,
      methods,
      t,
      setModalData,
      createUpdateTransfer,
      transferData,
      isGovernmentUser
    ]
  )

  const title = useMemo(() => {
    const formattedTransferId = `CUT${transferId}`
    
    if (!editorMode) {
      return `${t('transfer:transferID')} ${formattedTransferId}`
    }
    switch (mode) {
      case 'add':
        return t('transfer:newTransfer')
      case 'edit':
        return `${t('transfer:editTransferID')} ${formattedTransferId}`
      default:
        return `${t('transfer:transferID')} ${formattedTransferId}`
    }
  }, [editorMode, mode, t, transferId])

  // Conditional rendering for loading
  if (transferId && (isTransferDataLoading || queryState.status === 'pending'))
    return <Loading message={t('transfer:loadingText')} />
  if (isUpdatingTransfer)
    return <Loading message={t('transfer:processingText')} />

  if (
    (isLoadingError && editorMode !== 'add') ||
    queryState.status === 'error'
  ) {
    return (
      <BCAlert
        data-test="alert-box"
        severity={alertSeverity}
        dismissible={true}
        delay={50000}
      >
        {alertMessage}
      </BCAlert>
    )
  }

  return (
    <>
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
        {transferStatus !== TRANSFER_STATUSES.RECORDED && (
          <Role roles={[roles.supplier]}>
            <Typography variant="body4">
              {t('transfer:effectiveText')}
            </Typography>
            <br />
            <Typography variant="body4">
              {t('transfer:considerationText')}
            </Typography>
          </Role>
        )}
        {/* Progress bar */}
        <BCBox
          p={2}
          sx={{ width: '50%', alignContent: 'center', margin: 'auto' }}
        >
          <Stepper
            activeStep={steps.indexOf(transferStatus)}
            alternativeLabel={!isMobileSize}
            orientation={isMobileSize ? 'vertical' : 'horizontal'}
          >
            {steps.map((label, index) => {
              const labelProps = {}
              if (
                ['Rescinded', 'Declined', 'Refused', 'Deleted'].includes(label)
              ) {
                labelProps.error = true
              }
              return (
                <Step
                  key={label}
                  completed={index <= steps.indexOf(transferStatus)}
                  sx={{ marginTop: isMobileSize ? '-24px' : '0px' }}
                >
                  <StepLabel {...labelProps}>{label}</StepLabel>
                </Step>
              )
            })}
          </Stepper>
        </BCBox>
        {/* Form Provider  */}
        <FormProvider {...methods}>
          <form data-test="new-transfer-form">
            {editorMode ? (
              <>
                {/* Only the org user with transfer role assigned and having same organization can add/edit a transfer */}
                {/* Flow Representation of transaction */}
                <TransferGraphic />
                <TransferDetails />
                <AgreementDate />
                <Comments
                  editorMode={editorMode}
                  isGovernmentUser={isGovernmentUser}
                  commentField={'fromOrgComment'}
                />
              </>
            ) : (
              <TransferView
                transferId={transferId}
                editorMode={editorMode}
                transferData={transferData}
              />
            )}

            {[
              TRANSFER_STATUSES.SUBMITTED,
              TRANSFER_STATUSES.RECOMMENDED
            ].includes(currentStatus) &&
              hasAnyRole(roles.analyst, roles.director) && (
                <>
                  <Recommendation currentStatus={currentStatus} />
                  <CategoryCheckbox />
                </>
              )}

            {/* Signing Authority Confirmation show it to FromOrg user when in draft and ToOrg when in Sent status */}
            {(!currentStatus ||
              (currentStatus === TRANSFER_STATUSES.DRAFT &&
                currentUserOrgId === fromOrgId) ||
              (currentStatus === TRANSFER_STATUSES.SENT &&
                currentUserOrgId === toOrgId)) &&
              hasAnyRole(roles.signing_authority) && <SigningAuthority />}
            {/* Buttons */}
            <Stack
              component="div"
              direction={{ md: 'coloumn', lg: 'row' }}
              justifyContent="flex-end"
              mt={2}
              gap={2}
              spacing={2}
            >
              <BCButton
                variant="outlined"
                color="primary"
                style={{
                  gap: 8
                }}
                onClick={() => navigate(ROUTES.TRANSACTIONS)}
              >
                <FontAwesomeIcon icon={faArrowLeft} fontSize={8} />
                <Typography
                  variant="body4"
                  sx={{ textTransform: 'capitalize' }}
                >
                  {t('backBtn')}
                </Typography>
              </BCButton>
              {buttonClusterConfig[transferId ? currentStatus : 'New']?.map(
                (config) =>
                  config && (
                    <Role key={config.label}>
                      <BCButton
                        id={config.id}
                        size="small"
                        variant={config.variant}
                        color={config.color}
                        onClick={methods.handleSubmit(config.handler)}
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
          </form>
        </FormProvider>
      </BCBox>
    </>
  )
}
