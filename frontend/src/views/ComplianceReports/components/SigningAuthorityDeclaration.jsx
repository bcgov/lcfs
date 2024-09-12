import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, Paper, Typography } from '@mui/material'
import BCTypography from '@/components/BCTypography'

const SigningAuthorityDeclaration = ({ onChange }) => {
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
        padding: 2,
        marginTop: 2,
        textAlign: 'left',
        boxShadow: 'none',
        border: 'none'
      }}
      elevation={0}
    >
      <BCTypography color="primary" variant="h5">
        {t('report:signingAuthorityDeclaration')}
      </BCTypography>
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={handleChange}
            id="signing-authority-declaration"
            data-test="signing-authority-checkbox"
            color="primary"
          />
        }
        label={t('report:declarationText')}
        style={{
          marginLeft: 20,
          marginTop: 20,
          alignItems: 'flex-start'
        }}
      />
    </Paper>
  )
}

export default SigningAuthorityDeclaration
