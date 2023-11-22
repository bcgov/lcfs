import Pencil from '@/assets/icons/pencil.svg';
import colors from '@/assets/theme/base/colors';
import { BCTable } from '@/components/BCTable';
import { Stack, Typography } from '@mui/material';

// dummy data creation
const createData = (
  actionTaken,
  transactionType,
  transactionID,
  timestamp,
  organization,
) => {
  return {
    actionTaken,
    transactionType,
    transactionID,
    timestamp,
    organization,
  };
};

const rows = [
  createData('Transaction: IN', 159, 6.0, 24, 4.0),
  createData('Transaction: OUT', 237, 9.0, 37, 4.3),
  createData('Transaction: OUT', 262, 56.0, 24, 6.0),
  createData('Transaction: OUT', 305, 3.7, 67, 4.3),
  createData('Transaction: IN', 356, 16.0, 49, 3.9),
  createData('Transaction: IN', 305, 3.7, 67, 4.3),
  createData('Transaction: OUT', 159, 6.0, 24, 4.0),
  createData('Transaction: OUT', 262, 56.0, 24, 6.0),
  createData('Transaction: IN', 237, 9.0, 37, 4.3),
  createData('Transaction: IN', 356, 16.0, 49, 3.9),
  createData('Transaction: IN', 356, 16.0, 49, 3.9),
  createData('Transaction: IN', 356, 16.0, 49, 3.9),
  createData('Transaction: IN', 356, 16.0, 49, 3.9),
];

export const ViewUsers = () => {
  // call to api to fetch user by ID based on url param userID
  // const { userID } = useParams();
  // const apiService = useApiService();

  // const { data, isLoading, isError, error } = useQuery({
  //   queryKey: [`user-${userID}`],
  //   queryFn: async () => {
  //     const { data } = await apiService.get(`/users/${userID}`);
  //      // manipulate data here to comply with table data props. or do it on the backend.
  //     return data;
  //   },
  //   refetchOnWindowFocus: false,
  //   retry: false,
  // });

  return (
    <div>
      BCTable
      <Typography variant="h4" color={colors.primary.main} mb={2}>
        Billy Governance{' '}
        <span>
          <Pencil />
        </span>
      </Typography>

      <Stack direction="column" spacing={0.5} mb={5}>
        <Typography>
          <strong>Organization:</strong> Government of British Columbia
        </Typography>
        <Typography>
          <strong>Email:</strong> Billy.Biodesel@bio.com
        </Typography>
        <Typography>
          <strong>Work Phone:</strong> (778) 342-2312
        </Typography>
        <Typography>
          <strong>Mobile Phone:</strong> (250) 213-1232
        </Typography>
        <Typography>
          <strong>Status:</strong> Active
        </Typography>
        <Typography>
          <strong>Roles:</strong> Government Analyst
        </Typography>
        <Typography>
          <strong>Title:</strong> Senior Analyst
        </Typography>
      </Stack>

      <Typography variant="h4" color={colors.primary.main} mb={1}>
        User Activity
      </Typography>

      <BCTable
        data={rows}
        columns={[
          { label: 'Action Taken', field: 'actionTaken' },
          { label: 'Transaction Type', field: 'transactionType' },
          { label: 'Transaction ID', field: 'transactionID' },
          { label: 'Timestamp', field: 'timestamp' },
          { label: 'Organization', field: 'organization' },
        ]}
      />
    </div>
  );
};
