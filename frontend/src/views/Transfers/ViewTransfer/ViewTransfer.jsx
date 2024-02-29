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
import { useCurrentUser } from '@/hooks/useCurrentUser'

// Icons
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircle,
  faArrowLeft,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
// Sub components
import { OrganizationBadge } from '../../Transactions/components/OrganizationBadge'
import { demoData } from '../../Transactions/components/demo'
import { AttachmentList } from '../../Transactions/components/AttachmentList'
import { Comments } from '../../Transactions/components/Comments'
import { useTranslation } from 'react-i18next'
import Loading from '@/components/Loading'
import { useTransfer } from '@/hooks/useTransfer'

export const ViewTransfer = () => {
  const { t } = useTranslation(['common', 'transfer'])
  const iconSizeStyle = {
    fontSize: (theme) => `${theme.spacing(12)} !important`
  }
  const navigate = useNavigate()
  const { transferId } = useParams()
  const { data: currentUser } = useCurrentUser()
  const { data: transfer, isLoading } = useTransfer(transferId)
  const { 
    current_status: { status: transferStatus } = {}, 
    to_organization: { name: toOrganization } = {}, 
    from_organization: { name: fromOrganization } = {}, 
    quantity, 
    comments,
    price_per_unit: pricePerUnit 
  } = transfer || {}
  const totalValue = quantity * pricePerUnit
  const isGovernmentUser = currentUser?.is_government_user

  const steps = useMemo(() => {
    if (isGovernmentUser && transferStatus !== 'Refused') {
      return ['Draft', 'Sent', 'Submitted', 'Recommended', 'Recorded']
    }
    switch (transferStatus) {
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
  }, [isGovernmentUser, transferStatus])

  if (isLoading) return <Loading />
  return (
    <BCBox>
      {/* Header section */}
      <Typography variant="h5" color="primary">
        {t('transfer:transferID')} {transferId}
      </Typography>
      <Typography variant="body4">
        {t('transfer:effectiveText')}
      </Typography>
      <br />
      <Typography variant="body4">
        {t('transfer:considerationText')}
      </Typography>
      <BCBox
        p={2}
        sx={{ width: '50%', alignContent: 'center', margin: 'auto' }}
      >
        <Stepper activeStep={steps.indexOf(transferStatus)} alternativeLabel>
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
          organizationName={demoData.FromOrganization}
          totalBalance={10000}
          reservedBalance={100}
          registeredStatus={true}
          isGovernmentUser={isGovernmentUser}
          TransferStatus={demoData.status}
        />
        <Stack spacing={1} direction="column" justifyContent="center" pl={2}>
          <Typography variant="caption1" textAlign="center">
            {quantity} {t('transfer:complianceUnits')}
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
              value: totalValue
            })}
          </Typography>
        </Stack>
        <OrganizationBadge
          organizationName={demoData.FromOrganization}
          totalBalance={10000}
          reservedBalance={100}
          registeredStatus={true}
          isGovernmentUser={isGovernmentUser}
          TransferStatus={demoData.status}
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
          <b>{fromOrganization}</b>{t('transfer:transfers')}
          <b>{quantity}</b>{t('transfer:complianceUnitsTo')}{' '}
          <b>{toOrganization}</b>{t('transfer:for')}
          <b>${decimalFormatter({ value: pricePerUnit })}</b>
          {t('transfer:complianceUnitsPerTvo')}
          <b>
            $
            {decimalFormatter({
              value: totalValue
            })}
          </b>{' '}
          CAD.
        </Typography>
      </BCBox>
      {/* Comments */}
      <Comments comments={demoData.comments} />
      -- demo data --
      {/* List of attachments */}
      <AttachmentList attachments={demoData.attachments} /> 
      {/* Transaction History notes */}
      -- demo data --
      <BCBox mt={2}>
        <Typography variant="h6" color="primary">
          {t('transfer:txnHistory')}
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
      -- demo data --
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
              {t('backBtn')}
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
              {t('transfer:rescindTransferBtn')}
            </Typography>
          </BCButton>
        </Stack>
      </BCBox>
    </BCBox>
  )
}

// Defining PropTypes for the component
ViewTransfer.propTypes = {}
