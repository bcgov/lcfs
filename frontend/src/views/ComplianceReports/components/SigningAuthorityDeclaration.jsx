import React, { useState } from 'react'
import { Checkbox, FormControlLabel, Paper } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import BCButton from '@/components/BCButton'
import { useNavigate } from 'react-router-dom'
import BCTypography from '@/components/BCTypography'

const SigningAuthorityDeclaration = () => {
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
      console.log('Please certify the information before submitting')
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
        Signing authority declaration
      </BCTypography>
      <FormControlLabel
        control={<Checkbox checked={checked} onChange={handleCheckboxChange} />}
        label="I certify that the information in this report is true and complete to the best of my knowledge and I understand that I may be required to provide to the Director records evidencing the truth of that information."
        style={{
          marginLeft: 20,
          marginTop: 20,
          alignItems: 'flex-start'
        }}
      />
      <BCButton
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
          Submit Report
        </BCTypography>
      </BCButton>

    </Paper>
  )
}

export default SigningAuthorityDeclaration
