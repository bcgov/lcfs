import { CI_APPLICATION_STEPS, formatDate, getSupplierRequestDate, buildCIWorkflowSteps, getCIWorkflowConnectorStyle } from './ciWorkflowHelpers'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useTheme from '@mui/material/styles/useTheme'
import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import HourglassEmpty from '@mui/icons-material/HourglassEmpty'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'

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
            {`${step.countdown} days with applicant`}
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
    const currentStatus = ciApplication?.status?.status
    const isSubmitted = Boolean(currentStatus && currentStatus !== 'Draft')
    // Once the application reaches its terminal approved state, the final
    // "Government decision" step is complete too, so the BCeID pipeline stays in
    // sync with the grid's "Completed" status (#4652).
    const isCompleted = currentStatus === 'Completed'
    const wizardActiveStep = isCompleted
      ? CI_APPLICATION_STEPS.length
      : isSubmitted
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
