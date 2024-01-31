import React, { useState, useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

// Components
import BCTypography from '@/components/BCTypography'
import TransferInputs, { TransferInputsSchema } from './TransferInputs'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import Loading from '@/components/Loading'

// Hooks
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApiService } from '@/services/useApiService'
import { TRANSFERS_VIEW } from '@/constants/routes/routes'

export const NewTransfer = () => {
  const navigate = useNavigate()
  const apiService = useApiService()
  const { data: currentUser } = useCurrentUser()
  const [organizations, setOrganizations] = useState([])

  const methods = useForm({
    resolver: yupResolver(TransferInputsSchema),
    mode: 'onChange'
  })

  // useMutation hook from React Query for handling API request
  const { mutate, isLoading, isError } = useMutation({
    mutationFn: async (transferData) =>
      await apiService.post('/transfers', transferData),
    onSuccess: (response) => {
      // Redirect or handle success
      navigate(TRANSFERS_VIEW, {
        transferID: response.id, // TODO THIS NEEDS TO BE UPDATED TO THE CORRECT FIELD
        state: {
          message: 'Transfer successfully submitted.',
          severity: 'success'
        }
      })
    },
    onError: (error) => {
      // Handle error
      console.error('Error submitting transfer:', error)
    }
  })

  // Handle form submission
  const handleSubmitForm = (data) => {
    console.log('Transfer form submit.')
    mutate(data)
  }

  // Fetch organizations
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

  // Conditional rendering for loading
  if (isLoading) {
    return <Loading message="Submitting Transfer..." />
  }

  return (
    <>
      <BCBox mx={2}>
        <BCTypography variant="h5" color="primary">
          New Transfer
        </BCTypography>

        <BCTypography>
          A transfer is not effective until it is recorded by the Director.
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

        <FormProvider {...methods}>
          <form
            onSubmit={methods.handleSubmit(handleSubmitForm)}
            data-testid="new-transfer-form"
          >
            <TransferInputs
              currentOrg={currentUser?.organization}
              organizations={organizations}
            />
          </form>
        </FormProvider>
      </BCBox>
    </>
  )
}
