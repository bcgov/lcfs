import React, { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

// Components
import BCTypography from '@/components/BCTypography';
import TransferDetails, { TransferDetailsSchema } from './components/TransferDetails';

// Hooks
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApiService } from '@/services/useApiService'

export const AddTransaction = () => {
  const [organizations, setOrganizations] = useState([]);
  const apiService = useApiService();
  const { data: currentUser } = useCurrentUser()

  const methods = useForm({
    resolver: yupResolver(TransferDetailsSchema),
    mode: 'onChange',
    defaultValues: {
      organization: '',
    }
  });

   // Handle form submission
  const handleSubmitForm = (data) => {
    console.log(data);
  };

  // Fetch the list of registered external organizations
  useEffect(() => {
    const fetchOrganizations = async () => {
        try {
            const response = await apiService.get('/organizations/registered/external');
            const orgs = response.data.map(org => ({
                value: String(org.organization_id),
                label: org.name || 'Unknown'
            }));
            setOrganizations(orgs);
        } catch (error) {
            console.error('Error fetching organizations:', error);
        }
    };

    fetchOrganizations();
}, []);

  return (
    <>
      <BCTypography variant="h5">New Transfer</BCTypography>
      <BCTypography>A transfer is not effective until it is recorded by the Director.</BCTypography>
      <BCTypography>Transfers must indicate whether they are for consideration, and if so, the fair market value of the consideration in Canadian dollars per compliance unit.</BCTypography>
      <BCTypography>&nbsp;</BCTypography>

      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(handleSubmitForm)}>
          <TransferDetails
            currentOrg={currentUser?.organization}
            organizations={organizations}
          />
        </form>
      </FormProvider>
    </>
  );
}
