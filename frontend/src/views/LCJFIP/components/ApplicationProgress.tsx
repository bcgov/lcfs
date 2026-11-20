import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import { useTranslation } from 'react-i18next'

const STEP_KEYS = [
  'applicationInformation',
  'signAndSubmit',
  'governmentDecision'
] as const

/**
 * How many steps the application has reached. A reached step shows a check
 * mark, as in the mock-up, where a draft has reached "Application
 * information"; the Initiative Agreement steppers mark their steps the same
 * way.
 */
const stepsReachedForStatus = (status: string | null | undefined) => {
  if (!status || status === 'Draft') return 1
  if (status === 'Submitted') return 2
  return STEP_KEYS.length
}

export const ApplicationProgress = ({ status }: { status?: string | null }) => {
  const { t } = useTranslation(['lcjfip'])
  const reached = stepsReachedForStatus(status)
  return (
    <Stepper
      activeStep={reached - 1}
      alternativeLabel
      aria-label={t('lcjfip:steps.label')}
      data-test="lcjfip-progress"
      sx={{ my: 3 }}
    >
      {STEP_KEYS.map((key, index) => (
        <Step key={key} completed={index < reached}>
          <StepLabel>{t(`lcjfip:steps.${key}`)}</StepLabel>
        </Step>
      ))}
    </Stepper>
  )
}
