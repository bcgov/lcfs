import React, { useState, useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { Box } from '@mui/material'

// Components
import BCTypography from '@/components/BCTypography'
import ProgressBreadcrumb from '@/components/ProgressBreadcrumb'
import TransferDetails, {
  TransferDetailsSchema
} from './components/TransferDetails'
import TransferGraphic from './components/TransferGraphic'
import Comment from './components/Comment'

// Hooks
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApiService } from '@/services/useApiService'

export const AddTransaction = () => {
  const [organizations, setOrganizations] = useState([])
  const apiService = useApiService()
  const { data: currentUser } = useCurrentUser()

  const methods = useForm({
    resolver: yupResolver(TransferDetailsSchema),
    mode: 'onChange',
    defaultValues: {
      organization: '',
      quantity: null,
      pricePerUnit: null
    }
  })

  // Handle form submission
  const handleSubmitForm = (data) => {
    console.log(data)
  }

  // Fetch the list of registered external organizations
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await apiService.get(
          '/organizations/registered/external'
        )
        const orgs = response.data.map((org) => ({
          value: String(org.organization_id),
          label: org.name || 'Unknown'
        }))
        setOrganizations(orgs)
      } catch (error) {
        console.error('Error fetching organizations:', error)
      }
    }

    fetchOrganizations()
  }, [])

  const { watch } = methods
  const quantity = parseInt(watch('quantity'))
  const creditsFrom = currentUser?.organization?.name
  const creditsTo =
    organizations.find((org) => org.value === watch('organization'))?.label ||
    ''
  const pricePerUnit = watch('pricePerUnit')
  const totalValue =
    quantity && pricePerUnit ? parseInt(quantity * pricePerUnit) : 0

  return (
    <>
      <BCTypography variant="h5">New Transfer</BCTypography>
      <BCTypography>
        A transfer is not effective until it is recorded by the Director.
      </BCTypography>
      <BCTypography>
        Transfers must indicate whether they are for consideration, and if so,
        the fair market value of the consideration in Canadian dollars per
        compliance unit.
      </BCTypography>

      <Box mt={5}>
        <ProgressBreadcrumb
          steps={['Draft', 'Sent', 'Submitted', 'Recorded']}
          currentStep="Draft"
        />
      </Box>

      <Box my={3}>
        <TransferGraphic
          creditsFrom={creditsFrom}
          creditsTo={creditsTo}
          numberOfCredits={quantity}
          totalValue={totalValue}
        />
      </Box>

      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(handleSubmitForm)}>
          {/* Transfer details */}
          <BCTypography variant="h6" sx={{ color: 'primary.main', mb: 1 }}>
            Transfer details (required)
          </BCTypography>
          <Box sx={{ border: '1px solid #c0c0c0', p: 2 }}>
            <TransferDetails
              currentOrg={currentUser?.organization}
              organizations={organizations}
            />
          </Box>

          {/* Comments */}
          <BCTypography
            variant="h6"
            sx={{ color: 'primary.main', mb: 1, mt: 4 }}
          >
            Comments (optional)
          </BCTypography>
          <Box sx={{ border: '1px solid #c0c0c0', p: 2 }}>
            <Comment />
          </Box>
        </form>
      </FormProvider>
    </>
  )
}
