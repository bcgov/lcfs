import { Controller } from 'react-hook-form'
import {
  TextField,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Box
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import PropTypes from 'prop-types'

export const BCFormText = ({
  name,
  control,
  label,
  optional,
  checkbox,
  checkboxLabel,
  onCheckboxChange,
  isChecked,
  disabled
}) => {
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
            <Box display="flex" gap={2} flexWrap="wrap">
              <BCTypography variant="label" component="span">
                {label}:&nbsp;
                {optional && (
                  <span className="optional" style={{ fontWeight: 'normal' }}>
                    (optional)
                  </span>
                )}
              </BCTypography>
              {checkbox && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isChecked}
                      onChange={onCheckboxChange}
                      size="small"
                      sx={{
                        marginTop: 0.5,
                        '& .MuiSvgIcon-root': {
                          border: '0.0625rem solid rgb(63, 65, 68)'
                        }
                      }}
                    />
                  }
                  label={
                    <BCTypography variant="body4" component="span" color="text">
                      {checkboxLabel}
                    </BCTypography>
                  }
                  sx={{ ml: 2 }}
                />
              )}
            </Box>
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
            disabled={disabled}
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
  optional: PropTypes.bool,
  checkbox: PropTypes.bool,
  checkboxLabel: PropTypes.string,
  onCheckboxChange: PropTypes.func,
  isChecked: PropTypes.bool,
  disabled: PropTypes.bool
}
