import { Step, StepLabel, Stepper } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const CI_APPLICATION_STEPS = [
  { key: 'step1', labelKey: 'carbonIntensity:steps.step1' },
  { key: 'step2', labelKey: 'carbonIntensity:steps.step2' },
  { key: 'step3', labelKey: 'carbonIntensity:steps.step3' },
  { key: 'step4', labelKey: 'carbonIntensity:steps.step4' },
  { key: 'step5', labelKey: 'carbonIntensity:steps.step5' }
]

export const CIApplicationProgress = ({ activeStep = 0 }) => {
  const { t } = useTranslation(['carbonIntensity'])
  return (
    <Stepper
      activeStep={activeStep}
      alternativeLabel
      sx={{
        mb: 3,
        mt: 2,
        '& .MuiStepIcon-root': {
          width: 32,
          height: 32
        },
        '& .MuiStepIcon-text': {
          fontSize: '0.875rem'
        }
      }}
    >
      {CI_APPLICATION_STEPS.map((s) => (
        <Step key={s.key}>
          <StepLabel>{t(s.labelKey)}</StepLabel>
        </Step>
      ))}
    </Stepper>
  )
}

export default CIApplicationProgress
