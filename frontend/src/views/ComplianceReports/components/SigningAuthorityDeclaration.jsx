import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, Paper, Tooltip } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCAlert from '@/components/BCAlert'
import Box from '@mui/material/Box'

const SigningAuthorityDeclaration = ({ onChange, disabled }) => {
  const { t } = useTranslation(['report'])
  const [checked, setChecked] = useState(false)

  const handleChange = (event) => {
    setChecked(event.target.checked)
  }

  useEffect(() => {
    onChange(checked)
  }, [checked, onChange])

  return (
    <Paper
      sx={{
        marginTop: 2,
        textAlign: 'left',
        boxShadow: 'none',
        border: 'none'
      }}
      elevation={0}
    >
      <BCTypography color="primary" variant="h6">
        {t('report:signingAuthorityDeclaration')}
      </BCTypography>
      {disabled && (
        <Box sx={{ mt: '8px' }}>
          <BCAlert data-test="alert-box" severity="warning" noFade={true}>
            {t('report:cannotSubmit')}
          </BCAlert>
        </Box>
      )}
      <Tooltip
        title={disabled ? t('report:noSigningAuthorityTooltip') : ''}
        placement="top-start"
      >
        <FormControlLabel
          control={
            <Checkbox
              disabled={disabled}
              checked={checked}
              onChange={handleChange}
              id="signing-authority-declaration"
              data-test="signing-authority-checkbox"
              color="primary"
            />
          }
          label={t('report:declarationText')}
          style={{
            marginTop: 20,
            alignItems: 'flex-start'
          }}
        />
      </Tooltip>
    </Paper>
  )
}

export default SigningAuthorityDeclaration
