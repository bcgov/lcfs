// react and npm library components
import { useMemo, useState, useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  useLocation,
  useMatches,
  useNavigate,
  useParams
} from 'react-router-dom'
// constants
import { TRANSACTIONS } from '@/constants/routes/routes'
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
// hooks
import { yupResolver } from '@hookform/resolvers/yup'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTransfer, useCreateUpdateTransfer } from '@/hooks/useTransfer'
import { useRegExtOrgs } from '@/hooks/useOrganization'
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
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCAlert from '@/components/BCAlert'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
// sub components
import { dateFormatter } from '@/utils/formatters'
import {
  AgreementDate,
  Comments,
  TransferDetails,
  TransferView,
  TransferGraphic
} from '@/views/Transfers/components'
import { buttonClusterConfigFn, stepsConfigFn } from './buttonConfigs'
import SigningAuthority from './components/SigningAuthority'
import { AddEditTransferSchema } from './_schema'
import { Recommendation } from './components/Recommendation'

export const AddEditViewTransfer = () => {
  const theme = useTheme()
  const isMobileSize = useMediaQuery(theme.breakpoints.down('sm'))
  const [modalData, setModalData] = useState(null)
  const { t } = useTranslation(['common', 'transfer'])
  const navigate = useNavigate()
  const matches = useMatches()
  const mode = matches[matches.length - 1]?.handle?.mode
  const location = useLocation()
  const { transferId } = useParams()
  const [comment, setComment] = useState('')
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  // Fetch current user details
  const { data: currentUser, hasRoles, hasAnyRole } = useCurrentUser()
  const { data: toOrgData, isLoading: isToOrgDataLoading } = useRegExtOrgs()
  const isGovernmentUser = currentUser?.isGovernmentUser
  const currentUserOrgId = currentUser?.organization?.organizationId

  const methods = useForm({
    resolver: yupResolver(AddEditTransferSchema),
    mode: 'onChange',
    defaultValues: {
      fromOrganizationId: currentUser?.organization?.organizationId,
      agreementDate: new Date().toISOString().split('T')[0],
      toOrganizationId: null,
      quantity: null,
      pricePerUnit: null,
      signingAuthorityDeclaration: false,
      comments: '',
      recommendation: null
    }
  })

  // Fetch the transfer details
  const {
    data: transferData,
    isLoading: isTransferDataLoading,
    isFetched
  } = useTransfer(transferId, {
    enabled: !!transferId,
    retry: false
  })
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
      methods.reset({
        fromOrganizationId: transferData.fromOrganization.organizationId,
        toOrganizationId: transferData.toOrganization.organizationId,
        quantity: transferData.quantity,
        pricePerUnit: transferData.pricePerUnit,
        comments: transferData.comments?.comment, // Assuming you only want the comment text
        agreementDate: transferData.agreementDate
          ? dateFormatter(transferData.agreementDate)
          : new Date().toISOString().split('T')[0], // Format date or use current date as fallback
        recommendation: transferData.recommendation
      })
    }
  }, [isFetched, transferId])

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
                  transferId ? 'udpatedText' : 'createdText'
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
        navigate(TRANSACTIONS, {
          state: {
            message: t('transfer:actionMsgs.successText', {
              status: response.data.currentStatus.status.toLowerCase()
            }),
            severity: 'success'
          }
        })
      }
    },
    onError: (_error, _variables) => {
      setAlertMessage(
        transferId
          ? t('transfer:actionMsgs.errorUpdateText')
          : t('transfer:actionMsgs.errorCreateText')
      )
      setAlertSeverity('error')
    }
  })

  const handleCommentChange = (e) => {
    setComment(e.target.value)
  }

  const currentStatus = transferData?.currentStatus.status

  const {
    currentStatus: { status: transferStatus } = {},
    toOrganization: { name: toOrganization, organizationId: toOrgId } = {},
    fromOrganization: {
      name: fromOrganization,
      organizationId: fromOrgId
    } = {},
    quantity,
    comments,
    pricePerUnit,
    transferHistory
  } = transferData || {}

  const totalValue = quantity * pricePerUnit

  const steps = useMemo(
    () => stepsConfigFn(isFetched, isGovernmentUser, transferStatus),
    [isFetched, isGovernmentUser, transferStatus]
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
    if (!editorMode) {
      return t('transfer:transferID') + transferId
    }
    switch (mode) {
      case 'add':
        return t('transfer:newTransfer')
      case 'edit':
        return t('transfer:editTransferID') + transferId
      default:
        return t('transfer:transferID') + transferId
    }
  }, [editorMode, mode, t, transferId])

  // Conditional rendering for loading
  if (isTransferDataLoading)
    return <Loading message={t('transfer:loadingText')} />
  if (isUpdatingTransfer)
    return <Loading message={t('transfer:processingText')} />

  return (
    <>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
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
          <form data-testid="new-transfer-form">
            {editorMode ? (
              <>
                {/* Only the org user with transfer role assigned and having same organization can add/edit a transfer */}
                {/* Flow Representation of transaction */}
                <TransferGraphic />
                <TransferDetails />
                <AgreementDate />
                <Comments />
              </>
            ) : (
              <TransferView
                fromOrgId={fromOrgId}
                fromOrganization={fromOrganization}
                toOrgId={toOrgId}
                toOrganization={toOrganization}
                quantity={quantity}
                pricePerUnit={pricePerUnit}
                transferStatus={transferStatus}
                isGovernmentUser={isGovernmentUser}
                t={t}
                totalValue={totalValue}
                handleCommentChange={handleCommentChange}
                comment={comment}
                transferHistory={transferHistory}
              />
            )}

            {[
              TRANSFER_STATUSES.SUBMITTED,
              TRANSFER_STATUSES.RECOMMENDED
            ].includes(currentStatus) &&
              hasAnyRole(roles.analyst, roles.director) && (
                <Recommendation currentStatus={currentStatus} />
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
