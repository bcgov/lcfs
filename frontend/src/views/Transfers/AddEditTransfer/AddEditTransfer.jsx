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
import colors from '@/themes/base/colors'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box, Modal } from '@mui/material'
import {
  deleteDraftButton,
  saveDraftButton,
  submitButton
} from './buttonConfigs'
import AgreementDate from './components/AgreementDate'
import Comments from './components/Comments'
import SigningAuthority from './components/SigningAuthority'
import TransferDetails from './components/TransferDetails'
import ConfirmationModal from './components/ConfirmationModal'

export const AddEditTransfer = () => {
  const [modalData, setModalData] = useState(null)
  const navigate = useNavigate()
  const apiService = useApiService()
  const { transferId } = useParams()
  const { data: currentUser } = useCurrentUser()
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
          message: 'Draft transfer successfully created.',
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
          message: 'Draft transfer successfully updated.',
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
      { ...saveDraftButton, handler: createDraft },
      { ...submitButton, disabled: true }
    ],
    Draft: [
      {
        ...deleteDraftButton,
        handler: (formData) =>
          setModalData({
            onConfirm: () =>
              updateTransfer({
                formData,
                newStatus: 2,
                message: {
                  success: 'Draft transfer successfully deleted.',
                  error: 'Error deleting transfer'
                }
              }),
            buttonText: 'Delete Draft',
            text: 'Are you sure you want to delete this draft?'
          })
      },
      { ...saveDraftButton, handler: updateDraft },
      { ...submitButton, handler: () => console.log('submit draft') }
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
    return <Loading message="Creating Draft Transfer..." />
  }
  if (isUpdatingDraft) {
    return <Loading message="Updating Draft Transfer..." />
  }
  if (isUpdatingTransfer) {
    return <Loading message="Processing Transfer..." />
  }

  return (
    <>
      <ConfirmationModal data={modalData} onClose={() => setModalData(null)} />
      <BCBox mx={2}>
        <BCTypography variant="h5" color="primary">
          {transferId ? 'Edit Transfer' : 'New Transfer'}
        </BCTypography>

        <BCTypography>
          A transfer is not effective until it is recorded by the director.
        </BCTypography>
        <BCTypography>
          Transfers must indicate whether they are for consideration, and if so,
          the fair market value of the consideration in Canadian dollars per
          compliance unit.
        </BCTypography>
        <BCTypography>&nbsp;</BCTypography>

        {isCreateDraftError && (
          <BCAlert severity="error">
            Error occurred while submitting. Please retry. For ongoing issues,
            contact support.
          </BCAlert>
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
                  onClick={() => console.log('go back')}
                  startIcon={
                    <FontAwesomeIcon
                      icon={faArrowLeft}
                      color={colors.dark.main}
                    />
                  }
                >
                  Back
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
                        color={config.iconColor ?? colors.primary.main}
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
