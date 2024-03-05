import { yupResolver } from '@hookform/resolvers/yup'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'

// Components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import ProgressBreadcrumb from '@/components/ProgressBreadcrumb'
import { AddEditTransferSchema } from './_schema'
import TransferGraphic from './components/TransferGraphic'

// Hooks
import { TRANSACTIONS } from '@/constants/routes/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTransfer } from '@/hooks/useTransfer'
import { useApiService } from '@/services/useApiService'
import { convertObjectKeys, formatDateToISO } from '@/utils/formatters'

import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import {
  deleteDraftButton,
  saveDraftButton,
  submitButton
} from './buttonConfigs'
import AgreementDate from './components/AgreementDate'
import Comments from './components/Comments'
import SigningAuthority from './components/SigningAuthority'
import TransferDetails from './components/TransferDetails'
import TransferSummary from './components/TransferSummary'
import { roles } from '@/constants/roles'

export const AddEditTransfer = () => {
  const { t } = useTranslation(['common', 'transfer'])
  const [modalData, setModalData] = useState(null)
  const navigate = useNavigate()
  const apiService = useApiService()
  const { transferId } = useParams()
  const { data: currentUser, hasRoles } = useCurrentUser()
  const { data: transferData, isFetched } = useTransfer(transferId, {
    enabled: !!transferId,
    retry: false
  })

  const methods = useForm({
    resolver: yupResolver(AddEditTransferSchema),
    mode: 'onChange',
    defaultValues: {
      fromOrganizationId: currentUser?.organization?.organization_id,
      agreementDate: new Date().toISOString().split('T')[0],
      toOrganizationId: null,
      quantity: null,
      pricePerUnit: null,
      signingAuthorityDeclaration: false,
      comments: ''
    }
  })
  const { watch } = methods;
  const signingAuthorityDeclaration = watch('signingAuthorityDeclaration')

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
        fromOrganizationId: transferData.from_organization.organization_id,
        toOrganizationId: transferData.to_organization.organization_id,
        quantity: transferData.quantity,
        pricePerUnit: transferData.price_per_unit,
        signingAuthorityDeclaration: transferData.signing_authority_declaration,
        comments: transferData.comments?.comment, // Assuming you only want the comment text
        agreementDate: transferData.agreement_date
          ? new Date(transferData.agreement_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0] // Format date or use current date as fallback
      })
    }
  }, [isFetched, transferId])

  const draftPayload = (form) => {
    form.fromOrganizationId = parseInt(form.fromOrganizationId)
    form.toOrganizationId = parseInt(form.toOrganizationId)
    form.agreementDate = formatDateToISO(form.agreementDate)
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
      return await apiService.post('/transfers', data)
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

  // mutation to update the status and comments of a transfer
  // used in everything but draft transfers
  const {
    mutate: updateTransfer,
    isLoading: isUpdatingTransfer,
    isError: isUpdateTransferError
  } = useMutation({
    mutationFn: async ({ formData, newStatus }) =>
      await apiService.put(`/transfers/${transferId}`, {
        comments: formData.comments,
        current_status_id: newStatus
      }),
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

  // configuration for the button cluster at the bottom. each key corresponds to the status of the transfer and displays the appropriate buttons with the approriate configuration
  const buttonClusterConfig = {
    New: [
      { ...saveDraftButton(t('transfer:saveDraftBtn')), handler: createDraft },
      { ...submitButton(t('transfer:signAndSendBtn')), disabled: true }
    ],
    Draft: [
      {
        ...deleteDraftButton(t('transfer:deleteDraftBtn')),
        handler: (formData) =>
          setModalData({
            primaryButtonAction: () =>
              updateTransfer({
                formData,
                newStatus: 2,
                message: {
                  success: t('transfer:deleteSuccessText'),
                  error: t('transfer:deleteErrorText')
                }
              }),
            primaryButtonText: t('transfer:deleteDraftBtn'),
            primaryButtonColor: 'error',
            secondaryButtonText: t('cancelBtn'),
            title: t('confirmation'),
            content: t('transfer:deleteConfirmText')
          })
      },
      { ...saveDraftButton(t('transfer:saveDraftBtn')), handler: updateDraft },
      {
        ...submitButton(t('transfer:signAndSendBtn')),
        disabled: !hasRoles(roles.signing_authority) || !signingAuthorityDeclaration,
        handler: (formData) => {
          setModalData({
            primaryButtonAction: () =>
              updateTransfer({
                formData,
                newStatus: 3,
                message: {
                  success: t('transfer:sendSuccessText'),
                  error: t('transfer:sendErrorText')
                }
              }),
            primaryButtonText: t('transfer:signAndSendBtn'),
            secondaryButtonText: t('cancelBtn'),
            title: t('confirmation'),
            content: (
              <TransferSummary
                transferData={transferData}
                formData={formData}
              />
            )
          })
        }
      }
    ],
    Sent: [],
    Rescinded: [],
    Declined: [],
    Submitted: [],
    Recommended: [],
    Recorded: [],
    Refused: []
  }

  // Conditional rendering for loading
  if (isCreatingDraft) {
    return <Loading message={t('transfer:creatingText')} />
  }
  if (isUpdatingDraft) {
    return <Loading message={t('transfer:updatingText')} />
  }
  if (isUpdatingTransfer) {
    return <Loading message={t('transfer:processingText')} />
  }

  return (
    <>
      <BCModal
        open={!!modalData}
        onClose={() => setModalData(null)}
        data={modalData}
      />
      <BCBox mx={2}>
        <BCTypography variant="h5" color="primary">
          {transferId ? t('transfer:editTransfer') : t('transfer:newTransfer')}
        </BCTypography>

        <BCTypography variant="body4">
          {t('transfer:effectiveText')}
        </BCTypography>
        <br />
        <BCTypography variant="body4">
          {t('transfer:considerationText')}
        </BCTypography>

        {isCreateDraftError && (
          <BCAlert severity="error">{t('common:submitError')}</BCAlert>
        )}

        <BCBox mt={5}>
          <ProgressBreadcrumb
            steps={['Draft', 'Sent', 'Submitted', 'Recorded']}
            currentStep={
              transferId ? transferData?.current_status.status : null
            }
          />
        </BCBox>

        <FormProvider {...methods}>
          <BCBox my={3}>
            <TransferGraphic />
          </BCBox>

          <form data-testid="new-transfer-form">
            {/* Transfer Form Fields */}
            <TransferDetails />

            <AgreementDate />

            <Comments />

            <SigningAuthority />

            <Box mt={2} display="flex" justifyContent="flex-end" gap={2}>
              <Link>
                <BCButton
                  variant="outlined"
                  color="dark"
                  onClick={() => navigate(-1)}
                  startIcon={
                    <FontAwesomeIcon
                      icon={faArrowLeft}
                      className="small-icon"
                    />
                  }
                >
                  {t('common:backBtn')}
                </BCButton>
              </Link>
              {buttonClusterConfig[
                transferId ? transferData?.current_status.status : 'New'
              ]?.map((config) => (
                <BCButton
                  key={config.label}
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
              ))}
            </Box>
          </form>
        </FormProvider>
      </BCBox>
    </>
  )
}