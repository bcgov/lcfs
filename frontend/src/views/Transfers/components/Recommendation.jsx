import BCBox from '@/components/BCBox'
import { FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const Recommendation = ({ value, onChange }) => {
  const { t } = useTranslation(['common', 'transfer'])
  return (
    <BCBox mt={2}>
      <Typography variant="h6" color="primary" mb={2}>
        {t('transfer:analystRecommend')}
      </Typography>
      <RadioGroup
        row
        style={{
          gap: 24,
          alignItems: 'center'
        }}
        name="recommend"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <FormControlLabel
          value="record"
          control={<Radio />}
          label="Recommend Record"
        />
        <FormControlLabel
          value="refuse"
          control={<Radio />}
          label="Recommend Refuse"
        />
      </RadioGroup>
    </BCBox>
  )
}
