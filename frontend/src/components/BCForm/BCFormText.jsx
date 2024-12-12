import { Controller } from 'react-hook-form'
import { TextField, InputLabel } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import PropTypes from 'prop-types'

export const BCFormText = ({ name, control, label, optional }) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({
        field: { onChange, value },
        fieldState: { error },
        formState
      }) => (
        <>
          <InputLabel htmlFor={name} component="label" className="form-label">
            <BCTypography variant="label" component="span">
              {label}&nbsp;
              {optional && (
                <span className="optional" style={{ fontWeight: 'normal' }}>
                  (optional)
                </span>
              )}
            </BCTypography>
          </InputLabel>
          <TextField
            id={name}
            helperText={error ? error.message : null}
            size="medium"
            error={!!error}
            onChange={onChange}
            value={value}
            fullWidth
            variant="outlined"
          />
        </>
      )}
    />
  )
}

BCFormText.propTypes = {
  name: PropTypes.string.isRequired,
  control: PropTypes.any.isRequired,
  label: PropTypes.string,
  setValue: PropTypes.any
}
