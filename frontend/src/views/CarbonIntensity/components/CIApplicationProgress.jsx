import dayjs from 'dayjs'
import { Box, Stack, Tooltip, Typography, useTheme } from '@mui/material'
import { Check, Close, HourglassEmpty } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'

export const CI_APPLICATION_STEPS = [
  { key: 'step1', labelKey: 'carbonIntensity:steps.step1' },
  { key: 'step2', labelKey: 'carbonIntensity:steps.step2' },
  { key: 'step3', labelKey: 'carbonIntensity:steps.step3' },
  { key: 'step4', labelKey: 'carbonIntensity:steps.step4' },
  { key: 'step5', labelKey: 'carbonIntensity:steps.step5' }
]

const formatDate = (value) => (value ? dayjs(value).format('YYYY-MM-DD') : '')

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2)

const getUserName = (user) =>
  user?.fullName ||
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
  ''

const getUserInitials = (user) =>
  user?.initials || getInitials(getUserName(user))

const daysUntil = (date) => {
  if (!date) return null
  return dayjs(date).startOf('day').diff(dayjs().startOf('day'), 'day')
}

const daysSince = (date) => {
  if (!date) return null
  return dayjs().startOf('day').diff(dayjs(date).startOf('day'), 'day')
}

const getSupplierRequestDate = (ciApplication) =>
  ciApplication?.supplierRequestDate ||
  ciApplication?.requestFurtherDocumentationDate ||
  ciApplication?.requestDocumentationDate ||
  ciApplication?.pathwayChangesRequestedAt ||
  ciApplication?.pathwayChangesRequestedDate

const riskLabel = (risk) => (risk === 'Medium' ? 'Moderate' : risk)

const riskMeta = (risk, score) => {
  if (!risk && score == null) return ''
  return [risk ? `${riskLabel(risk)} risk` : null, score ?? null]
    .filter((part) => part !== null && part !== '')
    .join(' - ')
}

export const buildCIWorkflowSteps = (
  ciApplication = {},
  { showInternalSteps = true } = {}
) => {
  const status = ciApplication?.status?.status
  const isSubmitted = Boolean(ciApplication.signatureDateTime)
  const isApproved = status === 'Completed'
  const isWithdrawn = status === 'Withdrawn'
  const risk = ciApplication.preliminaryRiskAssessment
  const showVerification2 = risk === 'High'
  const recommendationComplete = Boolean(ciApplication.recommendationDate)
  const targetDate = ciApplication.proposedFuelCodeEffectiveDate
  const supplierRequestDate = getSupplierRequestDate(ciApplication)

  const submitterName =
    ciApplication.signatureUserDisplayName || ciApplication.signatureUser || ''
  const verification1Complete = Boolean(ciApplication.verification1Date)
  const verification2Complete = Boolean(ciApplication.verification2Date)

  const steps = [
    {
      key: 'submitted',
      label: 'Submitted',
      date: ciApplication.signatureDateTime,
      state: isSubmitted ? 'completed' : 'pending',
      initials: getInitials(submitterName),
      tooltip: submitterName
    }
  ]

  if (showInternalSteps) {
    steps.push({
      key: 'verification1',
      label: 'Verification 1',
      date: ciApplication.verification1Date,
      meta: riskMeta(
        ciApplication.preliminaryRiskAssessment,
        ciApplication.priorityScore
      ),
      state: verification1Complete ? 'completed' : 'pending',
      initials: verification1Complete
        ? getUserInitials(ciApplication.verification1User)
        : getUserInitials(ciApplication.assignedAnalyst),
      tooltip: verification1Complete
        ? getUserName(ciApplication.verification1User)
        : getUserName(ciApplication.assignedAnalyst)
    })
  }

  if (showInternalSteps && showVerification2) {
    steps.push({
      key: 'verification2',
      label: 'Verification 2',
      date: ciApplication.verification2Date,
      meta: riskMeta(
        ciApplication.verification2RiskAssessment,
        ciApplication.verification2PriorityScore
      ),
      state: verification2Complete ? 'completed' : 'pending',
      initials: verification2Complete
        ? getUserInitials(ciApplication.verification2User)
        : getUserInitials(ciApplication.assignedAnalyst),
      tooltip: verification2Complete
        ? getUserName(ciApplication.verification2User)
        : getUserName(ciApplication.assignedAnalyst)
    })
  }

  if (supplierRequestDate) {
    steps.push({
      key: 'withSupplier',
      label: 'With supplier',
      date: supplierRequestDate,
      state: 'waiting',
      icon: 'hourglass',
      countdown: daysSince(supplierRequestDate)
    })
  }

  if (showInternalSteps && recommendationComplete) {
    steps.push({
      key: 'recommendation',
      label: 'Recommend to director',
      date: ciApplication.recommendationDate,
      state: 'completed',
      initials: getUserInitials(ciApplication.recommendationUser),
      tooltip: getUserName(ciApplication.recommendationUser)
    })
  }

  if (isApproved) {
    steps.push({
      key: 'approved',
      label: 'Approved',
      date: ciApplication.approvalDate,
      state: 'completed',
      initials: getUserInitials(ciApplication.approvalUser),
      tooltip: getUserName(ciApplication.approvalUser)
    })
  } else if (isWithdrawn) {
    steps.push({
      key: 'withdrawn',
      label: 'Withdrawn',
      date: ciApplication.updateDate,
      state: 'completed',
      icon: 'close'
    })
  } else {
    steps.push({
      key: 'target',
      label: 'Proposed effective date',
      date: targetDate,
      state: 'target',
      countdown: daysUntil(targetDate)
    })
  }

  return steps
}

export const getCIWorkflowConnectorStyle = (currentStep, nextStep) =>
  currentStep?.state === 'completed' && nextStep?.state === 'completed'
    ? 'solid'
    : 'dotted'

const WorkflowNode = ({ step, isLast }) => {
  const theme = useTheme()
  const completed = step.state === 'completed'
  const target = step.state === 'target'
  const waiting = step.state === 'waiting'
  const withdrawn = step.key === 'withdrawn'
  const connectorStyle = step.connectorStyle || (completed ? 'solid' : 'dotted')

  const circleStyles = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 2,
    borderColor: completed
      ? withdrawn
        ? theme.palette.error.main
        : theme.palette.primary.main
      : waiting
        ? theme.palette.warning.main
        : theme.palette.grey[400],
    bgcolor: completed
      ? withdrawn
        ? theme.palette.error.main
        : theme.palette.primary.main
      : waiting || target
        ? theme.palette.common.white
        : theme.palette.grey[300],
    color: completed
      ? theme.palette.common.white
      : waiting
        ? theme.palette.warning.main
        : theme.palette.text.secondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.875rem'
  }

  const content = target ? (
    <Box
      aria-hidden="true"
      sx={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: 3,
        borderColor: 'grey.400',
        position: 'relative',
        '&:before': {
          content: '""',
          position: 'absolute',
          inset: 3,
          borderRadius: '50%',
          border: 3,
          borderColor: 'grey.300'
        },
        '&:after': {
          content: '""',
          position: 'absolute',
          inset: 8,
          borderRadius: '50%',
          bgcolor: 'grey.300'
        }
      }}
    />
  ) : step.initials ? (
    step.initials
  ) : step.icon === 'hourglass' ? (
    <HourglassEmpty fontSize="small" />
  ) : step.icon === 'close' ? (
    <Close fontSize="small" />
  ) : completed ? (
    <Check fontSize="small" />
  ) : null

  const node = <Box sx={circleStyles}>{content}</Box>

  return (
    <Box sx={{ flex: 1, minWidth: 124, position: 'relative' }}>
      {!isLast && (
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            top: 20,
            left: 'calc(50% + 22px)',
            width: 'calc(100% - 44px)',
            borderTop: connectorStyle === 'solid' ? 3 : 3,
            borderStyle: connectorStyle,
            borderColor: connectorStyle === 'solid' ? 'grey.500' : 'grey.400',
            zIndex: 0
          }}
        />
      )}
      <Stack
        alignItems="center"
        spacing={0.75}
        sx={{ position: 'relative', zIndex: 1 }}
      >
        {step.tooltip ? (
          <Tooltip
            title={step.tooltip}
            arrow
            placement="top"
            slotProps={{
              tooltip: {
                sx: {
                  bgcolor: 'primary.main',
                  color: 'common.white',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  px: 1.5,
                  py: 0.5
                }
              },
              arrow: {
                sx: {
                  color: 'primary.main'
                }
              }
            }}
          >
            <span>{node}</span>
          </Tooltip>
        ) : (
          node
        )}
        <Typography
          variant="body2"
          align="center"
          sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1.15 }}
        >
          {step.label}
        </Typography>
        {step.date && (
          <Typography
            variant="body2"
            color="primary.main"
            align="center"
            sx={{ fontWeight: 700, lineHeight: 1.15 }}
          >
            {formatDate(step.date)}
          </Typography>
        )}
        {step.meta && (
          <Typography
            variant="body2"
            color="primary.main"
            align="center"
            sx={{ fontWeight: 700, lineHeight: 1.15 }}
          >
            {step.meta}
          </Typography>
        )}
        {target && step.countdown !== null && (
          <Typography
            variant="body2"
            color="primary.main"
            align="center"
            sx={{ fontWeight: 700, lineHeight: 1.15 }}
          >
            {step.countdown >= 0
              ? `${step.countdown} days remaining`
              : `${Math.abs(step.countdown)} days past`}
          </Typography>
        )}
        {waiting && step.countdown !== null && (
          <Typography
            variant="body2"
            color="primary.main"
            align="center"
            sx={{ fontWeight: 700, lineHeight: 1.15 }}
          >
            {`${step.countdown} days with supplier`}
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

export const CIApplicationProgress = ({ activeStep = 0, ciApplication }) => {
  const { t } = useTranslation(['carbonIntensity'])
  const { hasAnyRole } = useCurrentUser()

  const showInternalSteps = Boolean(
    hasAnyRole?.(
      roles.government,
      roles.analyst,
      roles.compliance_manager,
      roles.director
    )
  )

  // BCeID/supplier users keep the 5-step wizard progress bar through the whole
  // lifecycle (ticket #4537); only government users switch to the internal
  // workflow timeline once the application leaves Draft.
  const isDraftWizard =
    ciApplication?.status?.status === 'Draft' &&
    !getSupplierRequestDate(ciApplication)

  if (!ciApplication || !showInternalSteps || isDraftWizard) {
    // Once submitted, the supplier steps (1-4) are complete, so mark them done
    // and leave Government decision pending. While drafting, follow the
    // URL-driven active step.
    const isSubmitted = Boolean(
      ciApplication?.status?.status &&
        ciApplication.status.status !== 'Draft'
    )
    const wizardActiveStep = isSubmitted
      ? CI_APPLICATION_STEPS.length - 1
      : activeStep

    return (
      <Stack direction="row" sx={{ mb: 3, mt: 2 }}>
        {CI_APPLICATION_STEPS.map((step, index) => (
          <WorkflowNode
            key={step.key}
            isLast={index === CI_APPLICATION_STEPS.length - 1}
            step={{
              key: step.key,
              label: t(step.labelKey),
              state: index < wizardActiveStep ? 'completed' : 'pending',
              initials: index < wizardActiveStep ? String(index + 1) : ''
            }}
          />
        ))}
      </Stack>
    )
  }

  const workflowSteps = buildCIWorkflowSteps(ciApplication, {
    showInternalSteps
  })

  return (
    <Box sx={{ overflowX: 'auto', pb: 4, mb: 1, mt: 1 }}>
      <Stack direction="row" sx={{ minWidth: workflowSteps.length * 240 }}>
        {workflowSteps.map((step, index) => (
          <WorkflowNode
            key={step.key}
            step={{
              ...step,
              connectorStyle: getCIWorkflowConnectorStyle(
                step,
                workflowSteps[index + 1]
              )
            }}
            isLast={index === workflowSteps.length - 1}
          />
        ))}
      </Stack>
    </Box>
  )
}

export default CIApplicationProgress
