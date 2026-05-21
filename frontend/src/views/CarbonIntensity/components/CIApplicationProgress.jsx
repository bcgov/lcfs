import dayjs from 'dayjs'
import { Box, Stack, Tooltip, Typography, useTheme } from '@mui/material'
import { Check } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'

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

const riskLabel = (risk) => (risk === 'Medium' ? 'Moderate' : risk)

const riskMeta = (risk, score) => {
  if (!risk && score == null) return ''
  return [risk ? `${riskLabel(risk)} risk` : null, score ?? null]
    .filter((part) => part !== null && part !== '')
    .join(' - ')
}

export const buildCIWorkflowSteps = (ciApplication = {}) => {
  const status = ciApplication?.status?.status
  const isSubmitted = Boolean(ciApplication.signatureDateTime)
  const isApproved = status === 'Completed'
  const risk = ciApplication.preliminaryRiskAssessment
  const showVerification2 = risk === 'Medium' || risk === 'High'
  const recommendationComplete = Boolean(ciApplication.recommendationDate)
  const targetDate = ciApplication.proposedFuelCodeEffectiveDate

  const submitterName =
    ciApplication.signatureUserDisplayName || ciApplication.signatureUser || ''

  const steps = [
    {
      key: 'submitted',
      label: 'Submitted',
      date: ciApplication.signatureDateTime,
      state: isSubmitted ? 'completed' : 'pending',
      initials: getInitials(submitterName),
      tooltip: submitterName
    },
    {
      key: 'verification1',
      label: 'Verification 1',
      date: ciApplication.verification1Date,
      meta: riskMeta(
        ciApplication.preliminaryRiskAssessment,
        ciApplication.priorityScore
      ),
      state: ciApplication.verification1Date ? 'completed' : 'pending',
      initials:
        getUserInitials(ciApplication.verification1User) ||
        getUserInitials(ciApplication.assignedAnalyst),
      tooltip:
        getUserName(ciApplication.verification1User) ||
        getUserName(ciApplication.assignedAnalyst)
    }
  ]

  if (showVerification2) {
    steps.push({
      key: 'verification2',
      label: 'Verification 2',
      date: ciApplication.verification2Date,
      meta: riskMeta(
        ciApplication.verification2RiskAssessment,
        ciApplication.verification2PriorityScore
      ),
      state: ciApplication.verification2Date ? 'completed' : 'pending',
      initials:
        getUserInitials(ciApplication.verification2User) ||
        getUserInitials(ciApplication.assignedAnalyst),
      tooltip:
        getUserName(ciApplication.verification2User) ||
        getUserName(ciApplication.assignedAnalyst)
    })
  }

  if (recommendationComplete) {
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
  const connectorStyle = step.connectorStyle || (completed ? 'solid' : 'dotted')

  const circleStyles = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 2,
    borderColor: completed
      ? theme.palette.primary.main
      : theme.palette.grey[400],
    bgcolor: completed
      ? theme.palette.primary.main
      : target
        ? theme.palette.common.white
        : theme.palette.grey[300],
    color: completed
      ? theme.palette.common.white
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
      </Stack>
    </Box>
  )
}

export const CIApplicationProgress = ({ activeStep = 0, ciApplication }) => {
  const { t } = useTranslation(['carbonIntensity'])

  if (!ciApplication || ciApplication?.status?.status === 'Draft') {
    return (
      <Stack direction="row" sx={{ mb: 3, mt: 2 }}>
        {CI_APPLICATION_STEPS.map((step, index) => (
          <WorkflowNode
            key={step.key}
            isLast={index === CI_APPLICATION_STEPS.length - 1}
            step={{
              key: step.key,
              label: t(step.labelKey),
              state: index < activeStep ? 'completed' : 'pending',
              initials: index < activeStep ? String(index + 1) : ''
            }}
          />
        ))}
      </Stack>
    )
  }

  const workflowSteps = buildCIWorkflowSteps(ciApplication)

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
