// react and npm library components
import { useMemo, useState, useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMatches, useNavigate, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
// constants
import { TRANSACTIONS } from '@/constants/routes/routes'
import { statuses } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
// hooks
import { yupResolver } from '@hookform/resolvers/yup'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTransfer, useUpdateTransfer } from '@/hooks/useTransfer'
import { useApiService } from '@/services/useApiService'
// icons and related components
import { faArrowLeft, faCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// mui components
import {
  List,
  ListItem,
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
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
// sub components
import {
  convertObjectKeys,
  decimalFormatter,
  dateFormatter
} from '@/utils/formatters'
import {
  AddPlainComment,
  AgreementDate,
  AttachmentList,
  CommentList,
  Comments,
  TransferDetails,
  TransferDetailsCard,
  TransferGraphic
} from '@/views/Transfers/components'
import { buttonClusterConfigFn, stepsConfigFn } from './buttonConfigs'
import SigningAuthority from './components/SigningAuthority'
import { demoData } from './components/demo'
import { AddEditTransferSchema } from './_schema'

export const AddEditViewTransfer = () => {
  const theme = useTheme()
  const isMobileSize = useMediaQuery(theme.breakpoints.down('sm'))
  const [modalData, setModalData] = useState(null)
  const { t } = useTranslation(['common', 'transfer'])
  const navigate = useNavigate()
  const matches = useMatches()
  const mode = matches[matches.length - 1]?.handle?.mode
  const apiService = useApiService()
  const { transferId } = useParams()
  const [comment, setComment] = useState('')
  // Fetch current user details
  const { data: currentUser, hasRoles, hasAnyRole } = useCurrentUser()
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
      comments: ''
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
        signingAuthorityDeclaration: transferData.signingAuthorityDeclaration,
        comments: transferData.comments?.comment, // Assuming you only want the comment text
        agreementDate: transferData.agreementDate
          ? dateFormatter(transferData.agreementDate)
          : new Date().toISOString().split('T')[0] // Format date or use current date as fallback
      })
    }
  }, [isFetched, transferId])

  const draftPayload = (form) => {
    form.fromOrganizationId = parseInt(form.fromOrganizationId)
    form.toOrganizationId = parseInt(form.toOrganizationId)
    form.agreementDate = dateFormatter(form.agreementDate)
    return convertObjectKeys(form)
  }

  // mutation to create a draft transfer
  const {
    mutate: createDraft,
    isLoading: isCreatingDraft,
    isError: isCreateDraftError
  } = useMutation({
    mutationFn: async (formData) => {
      const data = draftPayload(formData)
      return await apiService.post('/transfers/', data)
    },
    onSuccess: () => {
      navigate(TRANSACTIONS, {
        state: {
          message: t('transfer:createdText'),
          severity: 'success'
        }
      })
    },
    onError: (error) => {
      console.error('Error creating transfer:', error)
    }
  })

  // mutation to update a draft transfer
  const {
    mutate: updateDraft,
    isLoading: isUpdatingDraft,
    isError: isUpdateDraftError
  } = useMutation({
    mutationFn: async (formData) => {
      const data = draftPayload(formData)
      return await apiService.put(`/transfers/${transferId}/draft`, data)
    },
    onSuccess: () => {
      navigate(TRANSACTIONS, {
        state: {
          message: t('transfer:updatedText'),
          severity: 'success'
        }
      })
    },
    onError: (error) => {
      console.error('Error updating transfer:', error)
    }
  })
  // update status for the transfer via mutation function.
  const {
    mutate: updateTransfer,
    isLoading: isUpdatingTransfer,
    isError: isUpdateTransferError
  } = useUpdateTransfer(transferId, {
    onSuccess: (_, variables) => {
      navigate(TRANSACTIONS, {
        state: {
          message: variables.message.success,
          severity: 'success'
        }
      })
    },
    onError: (error, variables) => {
      console.error(variables.message.error, error)
    }
  })

  const handleCommentChange = (e) => {
    setComment(e.target.value)
  }

  const { watch } = methods
  const signingAuthorityDeclaration = watch('signingAuthorityDeclaration')
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
    pricePerUnit
  } = transferData || {}

  const totalValue = quantity * pricePerUnit
  const isGovernmentUser = currentUser?.isGovernmentUser
  const currentUserOrgId = currentUser?.organization?.organizationId

  const steps = useMemo(
    () => stepsConfigFn(isFetched, isGovernmentUser, transferStatus),
    [isFetched, isGovernmentUser, transferStatus]
  )

  const buttonClusterConfig = useMemo(
    () =>
      buttonClusterConfigFn({
        currentUserOrgId,
        toOrgId,
        hasAnyRole,
        t,
        setModalData,
        createDraft,
        updateDraft,
        updateTransfer,
        fromOrgId,
        hasRoles,
        signingAuthorityDeclaration,
        comment,
        transferData,
        isGovernmentUser
      }),
    [
      comment,
      createDraft,
      currentUserOrgId,
      fromOrgId,
      hasAnyRole,
      hasRoles,
      isGovernmentUser,
      signingAuthorityDeclaration,
      t,
      toOrgId,
      transferData,
      updateDraft,
      updateTransfer
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
  if (isCreatingDraft) return <Loading message={t('transfer:creatingText')} />
  if (isUpdatingDraft) return <Loading message={t('transfer:updatingText')} />
  if (isUpdatingTransfer)
    return <Loading message={t('transfer:processingText')} />

  return (
    <>
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
        {transferStatus !== 'Recorded' && (
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
              <>
                <TransferDetailsCard
                  fromOrgId={fromOrgId}
                  fromOrganization={fromOrganization}
                  toOrgId={toOrgId}
                  toOrganization={toOrganization}
                  quantity={quantity}
                  pricePerUnit={pricePerUnit}
                  transferStatus={transferStatus}
                  isGovernmentUser={isGovernmentUser}
                />
                {/* Transfer Details View only */}
                <BCBox
                  variant="outlined"
                  p={2}
                  mt={2}
                  sx={{
                    backgroundColor: 'transparent.main'
                  }}
                >
                  <Typography variant="body4">
                    <b>{fromOrganization}</b>
                    {t('transfer:transfers')}
                    <b>{quantity}</b>
                    {t('transfer:complianceUnitsTo')} <b>{toOrganization}</b>
                    {t('transfer:for')}
                    <b>${decimalFormatter({ value: pricePerUnit })}</b>
                    {t('transfer:complianceUnitsPerTvo')}
                    <b>${decimalFormatter(totalValue)}</b> CAD.
                  </Typography>
                </BCBox>
                -- demo data --
                {/* Comments */}
                <CommentList comments={demoData.comments} />
                <AddPlainComment
                  toOrgId={toOrgId}
                  isGovernmentUser={isGovernmentUser}
                  handleCommentChange={handleCommentChange}
                  comment={comment}
                  transferStatus={transferStatus}
                />
                -- demo data --
                {/* List of attachments */}
                <AttachmentList attachments={demoData.attachments} />
                {/* Transaction History notes */}
                -- demo data --
                <BCBox mt={2}>
                  <Typography variant="h6" color="primary">
                    {t('transfer:txnHistory')}
                  </Typography>
                  <List>
                    {demoData.transactionHistory.map((transaction) => (
                      <ListItem key={transaction.transactionID} disablePadding>
                        <BCBox mr={1} mb={1}>
                          <FontAwesomeIcon icon={faCircle} fontSize={6} />
                        </BCBox>
                        <Typography variant="body4">
                          {transaction.notes}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                </BCBox>
                -- demo data --
              </>
            )}
            {/* Signing Authority Confirmation show it to FromOrg user when in draft and ToOrg when in Sent status */}
            {(!currentStatus ||
              (currentStatus === statuses.draft &&
                currentUserOrgId === fromOrgId) ||
              (currentStatus === statuses.sent &&
                currentUserOrgId === toOrgId)) &&
              hasAnyRole(roles.signing_authority) && <SigningAuthority />}
            {/* Buttons */}
            <BCBox p={2} display="flex" justifyContent="flex-end">
              <Stack spacing={4} direction="row" justifyContent="center">
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
            </BCBox>
          </form>
        </FormProvider>
      </BCBox>
    </>
  )
}

// Defining PropTypes for the component
AddEditViewTransfer.propTypes = {}
