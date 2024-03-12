// hooks and configs
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTransfer, useUpdateTransfer } from '@/hooks/useTransfer'
import { decimalFormatter } from '@/utils/formatters'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { FormProvider, useForm } from 'react-hook-form'
import SigningAuthority from '../components/SigningAuthority'
import {
  rescindButton,
  declineButton,
  saveDraftButton,
  submitButton,
  plainContainedButton,
  plainRedBaseButton,
  plainOutlinedButton
} from '../buttonConfigs'
// constants
import { roles } from '@/constants/roles'
import { TRANSACTIONS } from '@/constants/routes/routes'
// mui icons & components
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
import { faArrowLeft, faCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import {
  List,
  ListItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
// sub components
import {
  AddPlainComment,
  AttachmentList,
  CommentList,
  OrganizationBadge
} from '@/views/Transfers/components'
import { demoData } from '../components/demo'
import { statuses } from '@/constants/statuses'

export const ViewTransfer = () => {
  const theme = useTheme()
  const isMobileSize = useMediaQuery(theme.breakpoints.down('sm'))
  const [modalData, setModalData] = useState(null)
  const { t } = useTranslation(['common', 'transfer'])
  const iconSizeStyle = {
    fontSize: (theme) => `${theme.spacing(12)} !important`,
    marginTop: '-28px',
    marginBottom: '-25px'
  }
  const navigate = useNavigate()
  const { transferId } = useParams()
  const { hasRoles, hasAnyRole } = useCurrentUser()
  const [comment, setComment] = useState('')
  const handleCommentChange = (e) => {
    setComment(e.target.value)
  }

  const { data: currentUser } = useCurrentUser()
  const {
    data: transferData,
    isLoading,
    isLoadingError,
    isFetched
  } = useTransfer(transferId, {
    enabled: !!transferId,
    retry: false
  })

  const {
    mutate: updateTransfer,
    isLoading: isUpdatingTransfer,
    isError: isUpdateTransferError
  } = useUpdateTransfer(transferId, {
    onSuccess: (_, variables) => {
      navigate(TRANSACTIONS, {
        state: {
          message: variables.message.success,
          severity: 'success'
        }
      })
    },
    onError: (error, variables) => {
      console.error(variables.message.error, error)
    }
  })

  const methods = useForm({
    mode: 'onChange',
    defaultValues: {
      signingAuthorityDeclaration: false
      // comments: ''
    }
  })
  const { watch } = methods
  const signingAuthorityDeclaration = watch('signingAuthorityDeclaration')
  const currentStatus = transferData?.currentStatus.status

  const {
    currentStatus: { status: transferStatus } = {},
    toOrganization: { name: toOrganization, organizationId: toOrgId } = {},
    fromOrganization: {
      name: fromOrganization,
      organizationId: fromOrgId
    } = {},
    quantity,
    comments,
    pricePerUnit
  } = transferData || {}

  const totalValue = quantity * pricePerUnit
  const isGovernmentUser = currentUser?.isGovernmentUser
  const currentUserOrgId = currentUser?.organization?.organizationId

  const steps = useMemo(() => {
    if (isFetched) {
      if (isGovernmentUser && transferStatus !== 'Refused') {
        return ['Draft', 'Sent', 'Submitted', 'Recommended', 'Recorded']
      }
      switch (transferStatus) {
        case 'Rescinded':
          return ['Draft', 'Rescinded', 'Submitted', 'Recorded']
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
    }
  }, [isFetched, isGovernmentUser, transferStatus])

  const buttonClusterConfig = {
    Deleted: [],
    Sent: [
      // Conditionally include the declineButton if currentUserOrgId equals toOrgId
      ...(currentUserOrgId === toOrgId &&
      hasAnyRole(roles.transfers, roles.signing_authority)
        ? [
            {
              ...declineButton(t('transfer:declineTransferBtn')),
              handler: (formData) =>
                setModalData({
                  primaryButtonAction: () =>
                    updateTransfer({
                      newStatus: 8,
                      message: {
                        success: t('transfer:declineSuccessText'),
                        error: t('transfer:declineErrorText')
                      }
                    }),
                  primaryButtonText: t('transfer:declineTransferBtn'),
                  primaryButtonColor: 'error',
                  secondaryButtonText: t('cancelBtn'),
                  title: t('confirmation'),
                  content: t('transfer:declineConfirmText')
                })
            }
          ]
        : []),

      // Conditionally include the rescindButton if currentUserOrgId equals fromOrgId
      ...(currentUserOrgId === fromOrgId &&
      hasRoles(roles.transfers, roles.signing_authority)
        ? [
            {
              ...rescindButton(t('transfer:rescindTransferBtn')),
              handler: (formData) =>
                setModalData({
                  primaryButtonAction: () =>
                    updateTransfer({
                      newStatus: 9,
                      message: {
                        success: t('transfer:rescindSuccessText'),
                        error: t('transfer:rescindErrorText')
                      }
                    }),
                  primaryButtonText: t('transfer:rescindTransferBtn'),
                  primaryButtonColor: 'error',
                  secondaryButtonText: t('cancelBtn'),
                  title: t('confirmation'),
                  content: t('transfer:rescindConfirmText')
                })
            }
          ]
        : []),

      {
        ...submitButton(t('transfer:signAndSubmitBtn')),
        disabled:
          !hasRoles(roles.signing_authority) || !signingAuthorityDeclaration,
        handler: (formData) => {
          setModalData({
            primaryButtonAction: () =>
              updateTransfer({
                // comments: formData.comments,
                newStatus: 4,
                message: {
                  success: t('transfer:sendSuccessText'),
                  error: t('transfer:sendErrorText')
                }
              }),
            primaryButtonText: t('transfer:signAndSubmitBtn'),
            primaryButtonColor: 'primary',
            secondaryButtonText: t('cancelBtn'),
            title: t('confirmation'),
            content: t('transfer:submitConfirmText')
          })
        }
      }
    ],
    Rescinded: [],
    Declined: [],
    Submitted: [
      {
        ...saveDraftButton(t('saveBtn')),
        handler: (formData) =>
          updateTransfer({
            comments: comment,
            newStatus: transferData?.currentStatus.transferStatusId,
            message: {
              success: t('transfer:commentSaveSuccessText'),
              error: t('transfer:commentSaveErrorText')
            }
          }),
        disabled: !isGovernmentUser
      }
    ],
    Recommended: [
      hasAnyRole(roles.analyst, roles.transfers) && {
        ...saveDraftButton(t('saveBtn')),
        handler: (formData) =>
          updateTransfer({
            comments: comment,
            newStatus: transferData?.currentStatus.transferStatusId,
            message: {
              success: t('transfer:commentSaveSuccessText'),
              error: t('transfer:commentSaveErrorText')
            }
          }),
        disabled: !isGovernmentUser
      },
      hasRoles(roles.director) && {
        ...plainContainedButton(t('transfer:recordTransferBtn')),
        disabled: false,
        handler: (formData) => {
          setModalData({
            primaryButtonAction: () =>
              updateTransfer({
                comments: comment,
                newStatus: 5,
                message: {
                  success: t('transfer:recordSuccessText'),
                  error: t('transfer:recordErrorText')
                }
              }),
            primaryButtonText: t('transfer:recordTransferBtn'),
            primaryButtonColor: 'primary',
            secondaryButtonText: t('cancelBtn'),
            title: t('confirmation'),
            content: t('transfer:recordConfirmText')
          })
        }
      }
    ],
    Recorded: [],
    Refused: []
  }

  if (isLoading) return <Loading />
  return (
    isFetched && (
      <>
        <BCModal
          open={!!modalData}
          onClose={() => setModalData(null)}
          data={modalData}
        />
        <BCBox>
          {/* Header section */}
          <Typography variant="h5" color="primary">
            {t('transfer:transferID')} {transferId}
          </Typography>
          <Role roles={[roles.supplier]}>
            <Typography variant="body4">
              {t('transfer:effectiveText')}
            </Typography>
            <br />
            <Typography variant="body4">
              {t('transfer:considerationText')}
            </Typography>
          </Role>
          <BCBox
            p={2}
            sx={{ width: '50%', alignContent: 'center', margin: 'auto' }}
          >
            <Stepper
              activeStep={steps.indexOf(transferStatus)}
              alternativeLabel={!isMobileSize}
              orientation={isMobileSize ? 'vertical' : 'horizontal'}
            >
              {steps.map((label, index) => {
                const labelProps = {}
                if (['Rescinded', 'Declined', 'Refused'].includes(label)) {
                  labelProps.error = true
                }
                return (
                  <Step
                    key={label}
                    completed={index < steps.indexOf(transferStatus)}
                    sx={{ marginTop: isMobileSize ? '-24px' : '0px' }}
                  >
                    <StepLabel {...labelProps}>{label}</StepLabel>
                  </Step>
                )
              })}
            </Stepper>
          </BCBox>
          {/* Flow Representation of transaction */}
          <Stack
            spacing={4}
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="center"
          >
            <OrganizationBadge
              organizationId={fromOrgId}
              organizationName={fromOrganization}
              isGovernmentUser={isGovernmentUser}
              transferStatus={transferStatus}
            />
            <Stack
              spacing={1}
              direction="column"
              justifyContent="center"
              pl={2}
            >
              <Typography variant="caption1" textAlign="center">
                {isMobileSize
                  ? `$${decimalFormatter(totalValue)}`
                  : `${quantity} ${t('transfer:complianceUnits')}`}
              </Typography>
              <BCBox
                display="flex"
                alignContent="center"
                flexDirection="column"
                alignItems="center"
                py={1}
              >
                {isMobileSize ? (
                  <SwapVertIcon color="primary" sx={{ ...iconSizeStyle }} />
                ) : (
                  <SyncAltIcon color="primary" sx={{ ...iconSizeStyle }} />
                )}
              </BCBox>
              <Typography variant="caption1" textAlign="center">
                {!isMobileSize
                  ? `$${decimalFormatter(totalValue)}`
                  : `${quantity} ${t('transfer:complianceUnits')}`}
              </Typography>
            </Stack>
            <OrganizationBadge
              organizationId={toOrgId}
              organizationName={toOrganization}
              isGovernmentUser={isGovernmentUser}
              transferStatus={transferStatus}
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
              <b>{fromOrganization}</b>
              {t('transfer:transfers')}
              <b>{quantity}</b>
              {t('transfer:complianceUnitsTo')} <b>{toOrganization}</b>
              {t('transfer:for')}
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
          -- demo data --
          {/* Comments */}
          <CommentList comments={demoData.comments} />
          <AddPlainComment
            toOrgId={toOrgId}
            isGovernmentUser={isGovernmentUser}
            handleCommentChange={handleCommentChange}
            comment={comment}
            transferStatus={transferStatus}
          />
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
                <ListItem key={transaction.transactionID} disablePadding>
                  <BCBox mr={1} mb={1}>
                    <FontAwesomeIcon icon={faCircle} fontSize={6} />
                  </BCBox>
                  <Typography variant="body4">{transaction.notes}</Typography>
                </ListItem>
              ))}
            </List>
          </BCBox>
          -- demo data --
          {/* Signing Authority Confirmation */}
          {currentStatus === statuses.sent && (
            <FormProvider {...methods}>
              <SigningAuthority />
            </FormProvider>
          )}
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
                <Typography
                  variant="body4"
                  sx={{ textTransform: 'capitalize' }}
                >
                  {t('backBtn')}
                </Typography>
              </BCButton>
              {buttonClusterConfig[
                transferId && transferData?.currentStatus.status
              ]?.map(
                (config) =>
                  config && (
                    <BCButton
                      key={config.label}
                      size="small"
                      variant={config.variant}
                      color={config.color}
                      onClick={config.handler}
                      startIcon={
                        config.startIcon && (
                          <FontAwesomeIcon
                            icon={config.startIcon}
                            className="small-icon"
                          />
                        )
                      }
                      disabled={config.disabled}
                    >
                      {config.label}
                    </BCButton>
                  )
              )}
            </Stack>
          </BCBox>
        </BCBox>
      </>
    )
  )
}

// Defining PropTypes for the component
ViewTransfer.propTypes = {}
