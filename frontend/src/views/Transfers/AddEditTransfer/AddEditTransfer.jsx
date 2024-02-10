import React, { useState, useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

// Components
import BCTypography from '@/components/BCTypography'
import ProgressBreadcrumb from '@/components/ProgressBreadcrumb'
import { AddEditTransferSchema } from './_schema'
import TransferForm from './TransferForm'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import Loading from '@/components/Loading'
import TransferGraphic from './components/TransferGraphic'

// Hooks
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApiService } from '@/services/useApiService'
import { TRANSFERS_VIEW } from '@/constants/routes/routes'
import { convertObjectKeys, formatDateToISO } from '@/utils/formatters'

export const AddEditTransfer = () => {
  const navigate = useNavigate()
  const apiService = useApiService()
  const { transferId } = useParams() // This extracts the transferId from the URL
  const { data: currentUser } = useCurrentUser()
  const [organizations, setOrganizations] = useState([])

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
    const fetchTransferData = async () => {
      if (!transferId) return
  
      try {
        const response = await apiService.get(`/transfers/${transferId}`)
        const transferData = response.data
  
        // Populate the form with fetched transfer data
        methods.reset({
          fromOrganizationId: transferData.from_organization.organization_id,
          toOrganizationId: transferData.to_organization.organization_id,
          quantity: transferData.quantity,
          pricePerUnit: transferData.price_per_unit,
          signingAuthorityDeclaration: transferData.signing_authority_declaration,
          comments: transferData.comments.comment, // Assuming you only want the comment text
          agreementDate: transferData.agreement_date ? 
            new Date(transferData.agreement_date).toISOString().split('T')[0] : 
            new Date().toISOString().split('T')[0], // Format date or use current date as fallback
        })
      } catch (error) {
        console.error('Error fetching transfer data:', error)
      }
    }
    if (transferId) fetchTransferData()
  }, [transferId])
  
  /**
   * Fetch the list of registered external organizations
  */ 
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await apiService.get(
          '/organizations/registered/external'
        )
        const orgs = response.data.map((org) => ({
          value: parseInt(org.organization_id),
          label: org.name || 'Unknown'
        }))
        setOrganizations(orgs)
      } catch (error) {
        console.error('Error fetching organizations:', error)
      }
    }
    fetchOrganizations()
  }, [])

  const { mutate, isLoading, isError } = useMutation({
      mutationFn: (convertedPayload) => {
        if (transferId) {
          // If editing, use PUT request
          return apiService.put(`/transfers/${transferId}`, convertedPayload)
        } else {
          // If adding new, use POST request
          return apiService.post('/transfers', convertedPayload)
        }
      },
      onSuccess: (response) => {
        // Redirect on success
        navigate(TRANSFERS_VIEW, {
          transferID: response.transfer_id,
          state: {
            message: 'Transfer successfully submitted.',
            severity: 'success',
          },
        })
      },
      onError: (error) => {
        console.error('Error submitting transfer:', error)
      },
    }
  )

  const handleSubmitForm = (form) => {
    form.fromOrganizationId = parseInt(form.fromOrganizationId)
    form.toOrganizationId = parseInt(form.toOrganizationId)
    form.agreementDate = formatDateToISO(form.agreementDate)
    const convertedPayload = convertObjectKeys(form)
    mutate(convertedPayload)
  }

  // Conditional rendering for loading
  if (isLoading) {
    return <Loading message="Submitting Transfer..." />
  }

  const { watch } = methods
  const quantity = parseInt(watch('quantity'))
  const creditsFrom = currentUser?.organization?.name
  const creditsTo =
    organizations.find((org) => org.value === watch('toOrganizationId'))
      ?.label || ''
  const pricePerUnit = watch('pricePerUnit')
  const totalValue =
    quantity && pricePerUnit ? parseInt(quantity * pricePerUnit) : 0

  return (
    <>
      <BCBox mx={2}>
        <BCTypography variant="h5" color="primary">
          {transferId ? 'Edit Transfer' : 'New Transfer'}
        </BCTypography>

        <BCTypography>
          A transfer is not effective until it is recorded by the Director.
        </BCTypography>
        <BCTypography>
          Transfers must indicate whether they are for consideration, and if so,
          the fair market value of the consideration in Canadian dollars per
          compliance unit.
        </BCTypography>
        <BCTypography>&nbsp</BCTypography>

        {isError && (
          <BCAlert severity="error">
            Error occurred while submitting. Please retry. For ongoing issues,
            contact support.
          </BCAlert>
        )}

        <BCBox mt={5}>
          <ProgressBreadcrumb
            steps={['Draft', 'Sent', 'Submitted', 'Recorded']}
            currentStep="Draft"
          />
        </BCBox>

        <BCBox my={3}>
          <TransferGraphic
            creditsFrom={creditsFrom}
            creditsTo={creditsTo}
            numberOfCredits={quantity}
            totalValue={totalValue}
          />
        </BCBox>

        <FormProvider {...methods}>
          <form
            onSubmit={methods.handleSubmit(handleSubmitForm)}
            data-testid="new-transfer-form"
          >
            {/* Transfer Form Fields */}
            <TransferForm
              currentOrg={currentUser?.organization}
              organizations={organizations}
            />
          </form>
        </FormProvider>
      </BCBox>
    </>
  )
}
