import { useState, useMemo } from 'react';
import { useMatches, useParams, useNavigate } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next';
import { yupResolver } from '@hookform/resolvers/yup'
import { roles, govRoles } from '@/constants/roles';
import { Role } from '@/components/Role'
import { ROUTES } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  useTheme,
  Stack,
  Typography,
  useMediaQuery,
  Step,
  StepLabel,
  Stepper
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import BCBox from '@/components/BCBox';
import BCButton from '@/components/BCButton'
import InternalComments from '@/components/InternalComments'
import {
  Comments,
  TransactionDetails,
} from '@/views/Transactions/components'
import { AddEditTransactionSchema } from './_schema.yup';
import { buttonClusterConfigFn } from './buttonConfigs'
import { TRANSACTION_STATUSES } from '@/constants/statuses'

// Component handles the transaction view for adding or editing
export const AddEditViewTransaction = () => {
  const theme = useTheme()
  const isMobileSize = useMediaQuery(theme.breakpoints.down('sm'))
  const { t } = useTranslation(['common', 'txn']);
  const matches = useMatches();
  const navigate = useNavigate()
  const [modalData, setModalData] = useState(null)
  const mode = matches[matches.length - 1]?.handle?.mode;
  const { transactionId } = useParams();
  const { data: currentUser, hasRoles, hasAnyRole } = useCurrentUser();
  const isGovernmentUser = currentUser?.isGovernmentUser
  const TransactionTypes = {
    ADMIN_ADJUSTMENT: 'AdminAdjustment',
    INITIATIVE_AGREEMENT: 'InitiativeAgreement'
  };
  const [transactionType, setTransactionType] = useState(TransactionTypes.INITIATIVE_AGREEMENT);
  const [steps, setSteps] = useState(['Draft', 'Recommended', 'Approved'])
  const transferStatus = ''

  const methods = useForm({
    resolver: yupResolver(AddEditTransactionSchema),
    mode: 'onChange',
    defaultValues: {
      toOrgComment: '',
    }
  });

  // Editor mode is active when user has the required roles and the mode is 'add' or 'edit'.
  const editorMode = ['edit', 'add'].includes(mode) && hasAnyRole(roles.analyst, roles.director)

  // Memoized title depends on mode and user permissions.
  const title = useMemo(() => {
    const typeKey = transactionType === TransactionTypes.INITIATIVE_AGREEMENT ? 'initiativeAgreementId' : 'adminAdjustmentId';
    
    if (!editorMode) return t(`txn:${typeKey}`) + ' ' + transactionId;
    switch (mode) {
      case 'add': return t('txn:newTransaction');
      case 'edit':
      default: return t(`txn:${typeKey}`) + ' ' + transactionId;
    }
  }, [editorMode, mode, t, transactionId, transactionType]);

  const buttonClusterConfig = useMemo(
    () =>
      buttonClusterConfigFn({
        transactionId,
        methods,
        t
      }),
    [
      transactionId,
      methods,
      t
    ]
  )

  return <>
    <FormProvider {...methods}>
      <BCBox>
        {/* Header section */}
        <Typography variant="h5" color="primary">
        {title}
        </Typography>

        {/* Progress bar */}
        <BCBox sx={{ margin: 'auto', justifyContent: 'center', width: '60%', paddingY: 2 }}>
          <Stepper
            activeStep={steps.indexOf(transferStatus)}
            alternativeLabel={!isMobileSize}
            orientation={isMobileSize ? 'vertical' : 'horizontal'}
          >
            {steps.map((label, index) => {
              const labelProps = {}
              if (
                ['Refused', 'Deleted'].includes(label)
              ) {
                labelProps.error = true
              }
              return (
                <Step
                  key={label}
                  completed={index <= steps.indexOf(transferStatus)}
                >
                  <StepLabel {...labelProps}>{label}</StepLabel>
                </Step>
              )
            })}
          </Stepper>
        </BCBox>

        {/* Transaction Details */}
        <TransactionDetails />

        {/* Comments */}
        <Comments
          editorMode={editorMode}
          isGovernmentUser={isGovernmentUser}
          commentField={'toOrgComment'}
        />

        {/* Internal Comments */}
        <BCBox mt={4}>
          <Typography variant="h6" color="primary">
            {t('txn:internalCommentsOptional')}
          </Typography>
          <BCBox>
            <Role roles={govRoles}>
              <InternalComments entityType={transactionType} entityId={transactionId ?? null} />
            </Role>
          </BCBox>
        </BCBox>

        {/* Buttons */}
        <Stack
          component="div"
          direction={{ md: 'coloumn', lg: 'row' }}
          justifyContent="flex-end"
          mt={2}
          gap={2}
          spacing={2}
        >
          <BCButton
            variant="outlined"
            color="primary"
            style={{
              gap: 8
            }}
            onClick={() => navigate(ROUTES.TRANSACTIONS)}
          >
            <FontAwesomeIcon icon={faArrowLeft} fontSize={8} />
            <Typography
              variant="body4"
              sx={{ textTransform: 'capitalize' }}
            >
              {t('backBtn')}
            </Typography>
          </BCButton>
          {buttonClusterConfig[transactionId ? transferStatus : TRANSACTION_STATUSES.NEW]?.map(
            (config) =>
              config && (
                <Role key={config.label}>
                  <BCButton
                    id={config.id}
                    size="small"
                    variant={config.variant}
                    color={config.color}
                    onClick={methods.handleSubmit(config.handler)}
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
                </Role>
              )
          )}
        </Stack>
      </BCBox>
    </FormProvider>
  </>
}
