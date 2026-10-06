import { InputLabel, TextField } from '@mui/material'
import BCTypography from '@/components/BCTypography'

// A labelled field for the module's modals.
//
// The app's theme lifts a shrunk MUI label clear of its input
// (`translate(12px, -32px)`), so an inline `label=` prop lands on top of
// whatever sits above it. The house pattern — see BCFormText — puts the
// label in the flow as its own block instead. These modals aren't
// react-hook-form based, so this is the same shape without the Controller.
export const ModalField = ({
  id,
  label,
  optional,
  value,
  onChange,
  type = 'text',
  autoFocus,
  inputProps,
  multiline,
  minRows
}) => (
  <div>
    <InputLabel htmlFor={id} component="label" className="form-label">
      <BCTypography variant="label" component="span">
        {label}
        {optional && (
          <span style={{ fontWeight: 'normal' }}>&nbsp;(optional)</span>
        )}
      </BCTypography>
    </InputLabel>
    <TextField
      id={id}
      fullWidth
      size="small"
      variant="outlined"
      type={type}
      value={value}
      autoFocus={autoFocus}
      multiline={multiline}
      minRows={minRows}
      onChange={onChange}
      inputProps={inputProps}
    />
  </div>
)

export default ModalField
