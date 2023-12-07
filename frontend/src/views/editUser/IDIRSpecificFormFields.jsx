import { FormHelperText, TextField } from '@mui/material'
import { Label } from './Label'

export const IDIRSpecificFormFields = ({ handleChange, formData, errors }) => {
  return (
    <>
      <div>
        <Label htmlFor="IDIRUserName">IDIR User Name</Label>
        <TextField
          fullWidth
          required
          error={!!errors.IDIRUserName}
          name="IDIRUserName"
          onChange={handleChange}
          value={formData.IDIRUserName}
          id="IDIRUserName"
        />
        {errors.IDIRUserName && (
          <FormHelperText error>{errors.IDIRUserName}</FormHelperText>
        )}
      </div>
      <div>
        <Label htmlFor="email">Email address</Label>
        <TextField
          fullWidth
          required
          error={!!errors.email}
          name="email"
          onChange={handleChange}
          value={formData.email}
          id="email"
        />
        {errors.email && <FormHelperText error>{errors.email}</FormHelperText>}
      </div>
    </>
  )
}
