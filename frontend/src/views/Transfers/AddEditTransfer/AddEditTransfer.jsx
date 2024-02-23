import { yupResolver } from '@hookform/resolvers/yup'
import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'

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
import { useRegExtOrgs } from '@/hooks/useOrganization'
import { useTransfer } from '@/hooks/useTransfer'
import { useApiService } from '@/services/useApiService'
import { convertObjectKeys, formatDateToISO } from '@/utils/formatters'

import { Box, Button } from '@mui/material'
import AgreementDate from './components/AgreementDate'
import Comments from './components/Comments'
import SigningAuthority from './components/SigningAuthority'
import TransferDetails from './components/TransferDetails'

export const AddEditTransfer = () => {
  const navigate = useNavigate()
  const apiService = useApiService()
  const { transferId } = useParams() // This extracts the transferId from the URL
  const { data: currentUser } = useCurrentUser()
  const { data: orgData } = useRegExtOrgs()
  const { data: transferData, isFetched } = useTransfer(transferId, {
    enabled: !!transferId,
    retry: false
  })
  // const [organizations, setOrganizations] = useState([])

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
        comments: transferData.comments.comment, // Assuming you only want the comment text
        agreementDate: transferData.agreement_date
          ? new Date(transferData.agreement_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0] // Format date or use current date as fallback
      })
    }
  }, [isFetched, transferId])

  /**
   * Fetch the list of registered external organizations
   */
  // useEffect(() => {
  //   const fetchOrganizations = async () => {
  //     try {
  //       const response = await apiService.get(
  //         '/organizations/registered/external'
  //       )
  //       const orgs = response.data.map((org) => ({
  //         value: parseInt(org.organization_id),
  //         label: org.name || 'Unknown'
  //       }))
  //       setOrganizations(orgs)
  //     } catch (error) {
  //       console.error('Error fetching organizations:', error)
  //     }
  //   }
  //   fetchOrganizations()
  // }, [])

  const { mutate, isLoading, isError } = useMutation({
    mutationFn: (convertedPayload) => {
      if (transferId) {
        // If editing, use PUT request
        return apiService.put(`/transfers`, convertedPayload)
      } else {
        // If adding new, use POST request
        return apiService.post('/transfers', convertedPayload)
      }
    },
    onSuccess: (response) => {
      // Redirect on success
      navigate(TRANSACTIONS, {
        state: {
          message: 'Transfer successfully submitted.',
          severity: 'success'
        }
      })
    },
    onError: (error) => {
      console.error('Error submitting transfer:', error)
    }
  })

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
    orgData.find(
      (org) => parseInt(org.organization_id) === watch('toOrganizationId')
    )?.name || ''

  console.log(creditsTo)
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
          A transfer is not effective until it is recorded by the director.
        </BCTypography>
        <BCTypography>
          Transfers must indicate whether they are for consideration, and if so,
          the fair market value of the consideration in Canadian dollars per
          compliance unit.
        </BCTypography>
        <BCTypography>&nbsp;</BCTypography>

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
            <TransferDetails />

            <AgreementDate />

            <Comments />

            <SigningAuthority />

            {/* Save Draft Button */}
            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                color="primary"
                onClick={() => console.log('Submitting form')}
              >
                Save Draft
              </Button>
            </Box>
          </form>
        </FormProvider>
      </BCBox>
    </>
  )
}
