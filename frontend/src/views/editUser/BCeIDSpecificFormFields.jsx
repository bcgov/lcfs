import { FormHelperText, TextField } from '@mui/material'
import { Label } from './Label'

export const BCeIDSpecificFormFields = ({ handleChange, formData, errors }) => {
  return (
    <>
      <div>
        <Label htmlFor="BCeIDUserID">BCeID Userid</Label>
        <TextField
          fullWidth
          required
          error={!!errors.BCeIDUserID}
          name="BCeIDUserID"
          onChange={handleChange}
          value={formData.BCeIDUserID}
          id="BCeIDUserID"
        />
        {errors.BCeIDUserID && (
          <FormHelperText error>{errors.BCeIDUserID}</FormHelperText>
        )}
      </div>

      <div>
        <Label htmlFor="email">
          Email address associated with the BCeID user account
        </Label>
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
      <div>
        <Label htmlFor="altEmail">
          Alternate email for notifications{' '}
          <span style={{ fontWeight: 'normal' }}>(optional)</span>
        </Label>
        <TextField
          fullWidth
          required
          error={!!errors.altEmail}
          name="altEmail"
          onChange={handleChange}
          value={formData.altEmail}
          id="altEmail"
        />
        {errors.altEmail && (
          <FormHelperText error>{errors.altEmail}</FormHelperText>
        )}
      </div>
    </>
  )
}
