import { useNavigate, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import {
  Typography,
  Stepper,
  Step,
  StepLabel,
  Stack,
  List,
  ListItem
} from '@mui/material'
import { useTransaction } from '@/hooks/useTransactions'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import { decimalFormatter } from '@/utils/formatters'
import { BTN_RESCIND_TRANSFER, BTN_APP_CANCEL } from '@/constants/langEnUs'
// Icons
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircle,
  faArrowLeft,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
// Sub components
import { OrganizationBadge } from '@/views/Transactions/components/OrganizationBadge'
import { demoData } from '@/views/Transactions/components/demo'
import { AttachmentList } from '@/views/Transactions/components/AttachmentList'
import { Comments } from '@/views/Transactions/components/Comments'
import Loading from '@/components/Loading'

export const ViewTransfer = () => {
  const iconSizeStyle = {
    fontSize: (theme) => `${theme.spacing(12)} !important`
  }
  const navigate = useNavigate()
  const { transactionID } = useParams()
  const { data: transaction, isLoading } = useTransaction(transactionID)
  // testing only -- Remove later
  const isGovernmentUser = true
  // -- Remove later

  const steps = useMemo(() => {
    if (isGovernmentUser && demoData.status !== 'Refused') {
      return ['Draft', 'Sent', 'Submitted', 'Recommended', 'Recorded']
    }
    switch (demoData.status) {
      case 'Rescind':
        return ['Draft', 'Rescind', 'Submitted', 'Recorded']
      case 'Declined':
        return ['Draft', 'Sent', 'Declined', 'Recorded']
      case 'Refused': {
        if (isGovernmentUser) {
          return ['Draft', 'Sent', 'Submitted', 'Recommended', 'Refused']
        }
        return ['Draft', 'Sent', 'Submitted', 'Refused']
      }
      default:
        return ['Draft', 'Sent', 'Submitted', 'Recorded']
    }
  }, [isGovernmentUser])

  if (isLoading) return <Loading />
  return (
    <BCBox>
      {/* Header section */}
      <Typography variant="h5" color="primary">
        Transfer—ID: {demoData.id}
      </Typography>
      <Typography variant="body4">
        A transfer is not effective until it is recorded by the Director.
      </Typography>
      <br />
      <Typography variant="body4">
        Transfers must indicate whether they are for consideration, and if so,
        the fair market value of the consideration in Canadian dollars per
        compliance unit.
      </Typography>
      <BCBox
        p={2}
        sx={{ width: '50%', alignContent: 'center', margin: 'auto' }}
      >
        <Stepper activeStep={steps.indexOf(demoData.status)} alternativeLabel>
          {steps.map((label, index) => {
            const labelProps = {}
            if (
              label === 'Rescind' ||
              label === 'Declined' ||
              label === 'Refused'
            ) {
              labelProps.error = true
            }
            return (
              <Step key={label}>
                <StepLabel {...labelProps}>{label}</StepLabel>
              </Step>
            )
          })}
        </Stepper>
      </BCBox>
      {/* Flow Representation of transaction */}
      <Stack spacing={4} direction="row" justifyContent="center">
        <OrganizationBadge
          content={demoData.FromOrganization}
          isGovernmentUser={isGovernmentUser}
        />
        <Stack spacing={1} direction="column" justifyContent="center" pl={2}>
          <Typography variant="caption1" textAlign="center">
            {demoData.noOfComplianceUnits} compliance units
          </Typography>
          <BCBox
            display="flex"
            alignContent="center"
            flexDirection="column"
            pl={2}
          >
            <SyncAltIcon
              color="primary"
              sx={{
                ...iconSizeStyle,
                marginTop: '-20px',
                marginBottom: '-25px'
              }}
            />
          </BCBox>
          <Typography variant="caption1" textAlign="center">
            $
            {decimalFormatter({
              value: demoData.noOfComplianceUnits * demoData.valuePerUnit
            })}
          </Typography>
        </Stack>
        <OrganizationBadge
          content={demoData.ToOrganization}
          isGovernmentUser={isGovernmentUser}
        />
      </Stack>
      <BCBox
        variant="outlined"
        p={2}
        mt={2}
        sx={{
          backgroundColor: 'transparent.main'
        }}
      >
        <Typography variant="body4">
          <b>{demoData.FromOrganization}</b> transfers{' '}
          <b>{demoData.noOfComplianceUnits}</b> compliance units to{' '}
          <b>{demoData.ToOrganization}</b> for{' '}
          <b>${decimalFormatter({ value: demoData.valuePerUnit })}</b> per
          compliance unit for a total value of{' '}
          <b>
            $
            {decimalFormatter({
              value: demoData.noOfComplianceUnits * demoData.valuePerUnit
            })}
          </b>{' '}
          CAD.
        </Typography>
      </BCBox>
      {/* Comments */}
      <Comments comments={demoData.comments} />
      {/* List of attachments */}
      <AttachmentList attachments={demoData.attachments} />
      {/* Transaction History notes */}
      <BCBox mt={2}>
        <Typography variant="h6" color="primary">
          Transaction History
        </Typography>
        <List>
          {demoData.transactionHistory.map((transaction) => (
            <ListItem key={transaction.id} disablePadding>
              <BCBox mr={1} mb={1}>
                <FontAwesomeIcon icon={faCircle} fontSize={6} />
              </BCBox>
              <Typography variant="body4">{transaction.notes}</Typography>
            </ListItem>
          ))}
        </List>
      </BCBox>
      {/* Buttons */}
      <BCBox p={2} display="flex" justifyContent="flex-end">
        <Stack spacing={4} direction="row" justifyContent="center">
          <BCButton
            variant="outlined"
            color="primary"
            style={{
              gap: 8
            }}
            onClick={() => navigate(-1)}
          >
            <FontAwesomeIcon icon={faArrowLeft} fontSize={8} />
            <Typography variant="body4" sx={{ textTransform: 'capitalize' }}>
              {BTN_APP_CANCEL}
            </Typography>
          </BCButton>
          <BCButton
            variant="outlined"
            color="error"
            sx={({ palette: { error } }) => ({
              gap: 2,
              '&:hover': {
                backgroundColor: error.main,
                boxShadow: 'none'
              },
              '&:active': {
                boxShadow: 'none',
                backgroundColor: error.main
              }
            })}
            p={4}
            onClick={() => console.log('clicked')}
          >
            <FontAwesomeIcon icon={faTrash} fontSize={8} />
            <Typography variant="body4" sx={{ textTransform: 'capitalize' }}>
              {BTN_RESCIND_TRANSFER}
            </Typography>
          </BCButton>
        </Stack>
      </BCBox>
    </BCBox>
  )
}

// Defining PropTypes for the component
ViewTransfer.propTypes = {}
