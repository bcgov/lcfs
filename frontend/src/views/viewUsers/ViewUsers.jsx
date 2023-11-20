import { ReactComponent as Pencil } from '@/assets/icons/pencil.svg';
import colors from '@/assets/theme/base/colors';
import {
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

function createData(
  actionTaken,
  transactionType,
  transactionID,
  timestamp,
  organization,
) {
  return {
    actionTaken,
    transactionType,
    transactionID,
    timestamp,
    organization,
  };
}

const rows = [
  createData('Frozen yoghurt', 159, 6.0, 24, 4.0),
  createData('Ice cream sandwich', 237, 9.0, 37, 4.3),
  createData('Eclair', 262, 56.0, 24, 6.0),
  createData('Cupcake', 305, 3.7, 67, 4.3),
  createData('Gingerbread', 356, 16.0, 49, 3.9),
];

export const ViewUsers = () => {
  // const { userID } = useParams();
  // const apiService = useApiService();

  // const { data, isLoading, isError, error } = useQuery({
  //   queryKey: ['user'],
  //   queryFn: async () => {
  //     const { data } = await apiService.get(`/users/${userID}`);
  //     return data;
  //   },
  //   refetchOnWindowFocus: false,
  //   retry: false,
  // });

  return (
    <div>
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

      <TableContainer component={Paper}>
        <Table aria-label="user activity table">
          <TableHead>
            <TableRow>
              <TableCell align="center">Action Taken</TableCell>
              <TableCell align="center">Transaction Type</TableCell>
              <TableCell align="center">Transaction ID</TableCell>
              <TableCell align="center">Timestamp</TableCell>
              <TableCell align="center">Organization</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.transactionID}>
                <TableCell align="center">{row.actionTaken}</TableCell>
                <TableCell align="center">{row.transactionType}</TableCell>
                <TableCell align="center">{row.transactionID}</TableCell>
                <TableCell align="center">{row.timestamp}</TableCell>
                <TableCell align="center">{row.organization}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};
