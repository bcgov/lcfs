import { useEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  useLocation,
  useMatches,
  useNavigate,
  useParams
} from 'react-router-dom'
import { roles, govRoles } from '@/constants/roles'
import { ROUTES, buildPath } from '@/routes/routes'
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCurrentOrgBalance } from '@/hooks/useOrganization'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import { useCreateUpdateTransfer, useTransfer } from '@/hooks/useTransfer'
import { yupResolver } from '@hookform/resolvers/yup'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Stack,
  Step,
  StepLabel,
  Stepper,
  useMediaQuery,
  useTheme
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
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
import InternalComments from '@/components/InternalComments'

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
  const [steps, setSteps] = useState(['Sent', 'Submitted', 'Recorded'])
  const { data: currentUser, hasRoles, hasAnyRole } = useCurrentUser()
  const { data: toOrgData } = useRegExtOrgs()
  const isGovernmentUser = !!currentUser?.isGovernmentUser
  const currentUserOrgId = currentUser?.organization?.organizationId
  const alertRef = useRef()

  const methods = useForm({
    resolver: yupResolver(AddEditTransferSchema),
    mode: 'onChange',
    defaultValues: {
      fromOrganizationId: currentUser?.organization?.organizationId || '',
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
      methods.reset((prevValues) => ({
        ...prevValues, // Preserve previous values
        fromOrganizationId: transferData.fromOrganization.organizationId,
        toOrganizationId: transferData.toOrganization.organizationId,
        quantity: transferData.quantity,
        pricePerUnit: transferData.pricePerUnit,
        agreementDate: transferData.agreementDate
          ? dateFormatter(transferData.agreementDate)
          : new Date().toISOString().split('T')[0],
        recommendation:
          prevValues.recommendation ?? transferData.recommendation,
        signingAuthorityDeclaration:
          prevValues.signingAuthorityDeclaration ?? false
      }))
    }
    if (isLoadingError || queryState?.status === 'error') {
      setAlertMessage(
        t('transfer:actionMsgs.errorRetrieval', {
          transferId
        })
      )
      setAlertSeverity('error')
    }
  }, [
    isFetched,
    transferId,
    isLoadingError,
    transferData,
    queryState,
    methods,
    t
  ])

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  // update status for the transfer via mutation function.
  const { mutate: createUpdateTransfer, isPending: isUpdatingTransfer } =
    useCreateUpdateTransfer(currentUserOrgId, transferId, {
      onSuccess: (response, variables) => {
        setModalData(null)
        if (response.data.currentStatus.status === TRANSFER_STATUSES.DRAFT) {
          navigate(
            buildPath(ROUTES.TRANSFERS.EDIT, {
              transferId: response.data.transferId
            }),
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
          // Navigate to the transactions list view
          navigate(
            ROUTES.TRANSACTIONS.LIST +
              `/?hid=transfer-${response.data.transferId}`,
            {
              state: {
                message: t('transfer:actionMsgs.successText', {
                  status: response.data.currentStatus.status.toLowerCase()
                }),
                severity: 'success'
              }
            }
          )
        }
        alertRef.current?.triggerAlert()
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

  const fromOrgId =
    transferData?.fromOrganization?.organizationId ||
    methods.getValues('fromOrganizationId')
  const toOrgId =
    transferData?.toOrganization?.organizationId ||
    methods.getValues('toOrganizationId')
  const transferStatus = transferData?.currentStatus?.status

  const commentField =
    currentUserOrgId === fromOrgId ? 'fromOrgComment' : 'toOrgComment'

  useEffect(() => {
    const statusSet = new Set()
    transferData?.transferHistory?.forEach((item) => {
      statusSet.add(item.transferStatus.status)
    })
    if (statusSet.length === 0) {
      setSteps(['Sent', 'Submitted', 'Recorded'])
    } else {
      statusSet.delete(TRANSFER_STATUSES.DRAFT)

      if (!statusSet.has(TRANSFER_STATUSES.SENT)) {
        statusSet.add(TRANSFER_STATUSES.SENT)
      }
      if (
        !statusSet.has(TRANSFER_STATUSES.SUBMITTED) &&
        !statusSet.has(TRANSFER_STATUSES.DECLINED)
      ) {
        statusSet.add(TRANSFER_STATUSES.SUBMITTED)
      }
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

  const recommendation = methods.watch('recommendation')
  const signingAuthorityDeclaration = methods.watch(
    'signingAuthorityDeclaration'
  )

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
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
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
      isGovernmentUser,
      recommendation,
      signingAuthorityDeclaration
    ]
  )

  const title = useMemo(() => {
    const formattedTransferId = `CT${transferId}`

    if (!editorMode) {
      return `${t('transfer:transferID')} ${formattedTransferId}`
    }
    switch (mode) {
      case 'add':
        return t('transfer:newTransfer')
      case 'edit':
        return `${t('transfer:editTransferID')} ${formattedTransferId}`
    }
  }, [editorMode, mode, t, transferId])

  // Conditional rendering for loading
  if (transferId && (isTransferDataLoading || queryState?.status === 'pending'))
    return <Loading message={t('transfer:loadingText')} />
  if (isUpdatingTransfer)
    return <Loading message={t('transfer:processingText')} />

  if (
    (isLoadingError && editorMode !== 'add') ||
    queryState?.status === 'error'
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
        <BCTypography variant="h5" color="primary">
          {title}
        </BCTypography>
        {transferStatus !== TRANSFER_STATUSES.RECORDED && (
          <Role roles={[roles.supplier]}>
            <BCTypography variant="body4">
              {t('transfer:effectiveText')}
            </BCTypography>
            <br />
            <BCTypography variant="body4">
              {t('transfer:considerationText')}
            </BCTypography>
          </Role>
        )}
        {/* Progress bar */}
        <BCBox
          p={2}
          sx={{ width: '50%', alignContent: 'center', margin: 'auto' }}
        >
          <Stepper
            data-test="stepper"
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
                  commentField={commentField}
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
              hasAnyRole(roles.analyst) && (
                <>
                  <Recommendation currentStatus={currentStatus} />
                  <CategoryCheckbox
                    isDisabled={currentStatus === TRANSFER_STATUSES.RECOMMENDED}
                  />
                </>
              )}

            {/* Internal Comments */}
            {!editorMode && (
              <Role roles={govRoles}>
                {transferId && (
                  <BCBox py={2}>
                    <InternalComments
                      entityType="Transfer"
                      entityId={transferId}
                    />
                  </BCBox>
                )}
              </Role>
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
                data-test="button-cluster-back"
                variant="outlined"
                size="small"
                color="primary"
                style={{
                  gap: 8
                }}
                onClick={() => navigate(ROUTES.TRANSACTIONS.LIST)}
              >
                <FontAwesomeIcon icon={faArrowLeft} fontSize={8} />
                <BCTypography
                  variant="body4"
                  sx={{ textTransform: 'capitalize' }}
                >
                  {t('backBtn')}
                </BCTypography>
              </BCButton>
              {buttonClusterConfig[transferId ? currentStatus : 'New']?.map(
                (config) =>
                  config && (
                    <Role key={config.label}>
                      <BCButton
                        data-test={config.id}
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
