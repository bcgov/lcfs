import { Checkbox, FormControlLabel, Radio, RadioGroup } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { govRoles } from '@/constants/roles'

export const IDIRSpecificRoleFields = ({
  formData,
  handleCheckbox,
  handleChange,
  register
}) => {
  const { t } = useTranslation('admin')
  return (
    <>
      <FormControlLabel
        control={<Checkbox {...register('roles')} data-test={govRoles[1]} />}
        label={
          <span>
            <strong>{govRoles[1]}</strong> —{' '}
            {t(`userForm.${govRoles[1].toLowerCase().replace(' ', '_')}`)}
          </span>
        }
        onChange={handleCheckbox}
        name={govRoles[1].toLocaleLowerCase()}
        checked={formData.administrator}
        disabled={formData.active === 'inactive'}
      />
      <RadioGroup
        defaultValue="active"
        name="govRole"
        style={{
          gap: 16,
          marginTop: 8
        }}
        onChange={handleChange}
        value={formData.govRole}
      >
        {govRoles.map(
          (role, idx) =>
            idx > 1 && (
              <FormControlLabel
                key={idx}
                value={role}
                control={<Radio />}
                style={{
                  '.MuiFormControlLabel-label': {
                    fontSize: 16
                  }
                }}
                label={
                  <span>
                    <strong>{role}</strong> —{' '}
                    {t(`userForm.${role.toLowerCase().replace(' ', '_')}`)}
                  </span>
                }
                disabled={formData.active === 'inactive'}
              />
            )
        )}
      </RadioGroup>
    </>
  )
}
