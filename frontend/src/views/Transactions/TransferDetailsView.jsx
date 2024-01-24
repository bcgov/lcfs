import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Stepper,
  Step,
  StepLabel,
  Stack,
  List,
  ListItem
} from '@mui/material'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import { decimalFormatter } from '@/utils/formatters'
import { BTN_RESCIND_TRANSFER, BTN_APP_CANCEL } from '@/constants/langEnUs'
// Icons
import arrowRight from '@/assets/icons/arrowRight.svg'
import arrowLeft from '@/assets/icons/arrowLeft.svg'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircle,
  faArrowLeft,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
// Sub components
import { OrganizationBadge } from './components/OrganizationBadge'
import { demoData } from './components/demo'
import { AttachmentList } from './components/AttachmentList'
import { Comments } from './components/Comments'

const idirSteps = ['Draft', 'Sent', 'Submitted', 'Recorded']

export const TransferDetailsView = () => {
  const navigate = useNavigate()
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
        <Stepper
          activeStep={idirSteps.indexOf(demoData.status)}
          alternativeLabel
        >
          {idirSteps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </BCBox>
      {/* Flow Representation of transaction */}
      <Stack spacing={4} direction="row" justifyContent="center">
        <OrganizationBadge content={demoData.FromOrganization} />
        <Stack spacing={-1} direction="column" justifyContent="center" pl={2}>
          <Typography variant="caption1" textAlign="center">
            {demoData.noOfComplianceUnits} compliance units
          </Typography>
          <BCBox
            display="flex"
            alignContent="center"
            flexDirection="column"
            pl={2}
          >
            <img
              src={arrowRight}
              alt="Arrow Right"
              style={{
                width: '7rem',
                marginTop: '-10px',
                height: 'auto'
              }}
            />
            <img
              src={arrowLeft}
              alt="Arrow Left"
              style={{
                width: '7rem',
                marginTop: '-40px',
                height: 'auto'
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
        <OrganizationBadge content={demoData.ToOrganization} />
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
TransferDetailsView.propTypes = {}
