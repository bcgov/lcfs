import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import { useTranslation } from 'react-i18next'

const STEP_KEYS = [
  'applicationInformation',
  'signAndSubmit',
  'governmentDecision'
] as const

/** Index of the current step; past the last step means all are complete. */
const activeStepForStatus = (status: string | null | undefined) => {
  if (!status || status === 'Draft') return 0
  if (status === 'Submitted') return 2
  return STEP_KEYS.length
}

export const ApplicationProgress = ({ status }: { status?: string | null }) => {
  const { t } = useTranslation(['lcjfip'])
  return (
    <Stepper
      activeStep={activeStepForStatus(status)}
      alternativeLabel
      aria-label={t('lcjfip:steps.label')}
      data-test="lcjfip-progress"
      sx={{ my: 3 }}
    >
      {STEP_KEYS.map((key) => (
        <Step key={key}>
          <StepLabel>{t(`lcjfip:steps.${key}`)}</StepLabel>
        </Step>
      ))}
    </Stepper>
  )
}
