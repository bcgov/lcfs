import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, Paper } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import BCButton from '@/components/BCButton'
import { useNavigate } from 'react-router-dom'
import BCTypography from '@/components/BCTypography'

const SigningAuthorityDeclaration = () => {
  const { t } = useTranslation(['report'])
  const [checked, setChecked] = useState(false)
  const navigate = useNavigate()

  const handleCheckboxChange = (event) => {
    setChecked(event.target.checked)
  }

  const handleSubmit = () => {
    if (checked) {
      // Action to submit the report
      console.log('Report submitted')
    } else {
      // Optionally, handle the case where the checkbox is not checked
      console.log(t('report:pleaseCheckDeclaration'))
    }
  }

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
        control={<Checkbox checked={checked} onChange={handleCheckboxChange} />}
        label={t('report:declarationText')}
        style={{
          marginLeft: 20,
          marginTop: 20,
          alignItems: 'flex-start'
        }}
      />
      {/* <BCButton
        variant="contained"
        color="primary"
        style={{
          gap: 8,
          marginTop: 20
        }}
        onClick={handleSubmit}
      >
        <FontAwesomeIcon icon={faPencil} fontSize={8} />
        <BCTypography
          variant="body4"
          sx={{ textTransform: 'capitalize' }}
        >
          {t('report:submitReport')}
        </BCTypography>
      </BCButton> */}
    </Paper>
  )
}

export default SigningAuthorityDeclaration