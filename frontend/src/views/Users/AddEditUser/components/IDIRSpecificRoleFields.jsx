import { Typography, Box } from '@mui/material'
import { BCFormCheckbox, BCFormRadio } from '@/components/BCForm'
import { govRoles } from '@/constants/roles'
import { idirRoleOptions } from '../_schema'

export const IDIRSpecificRoleFields = ({ form, disabled, t }) => {
  const { control } = form
  return (
    <Box>
      <Typography variant="label" component="span">
        {t('admin:Roles')}
      </Typography>
      <BCFormCheckbox
        name={'adminRole'}
        form={form}
        options={[
          {
            label: govRoles[1],
            header: govRoles[1],
            text: t(
              `admin:userForm.${govRoles[1].toLowerCase().replace(' ', '_')}`
            ),
            value: govRoles[1].toLowerCase()
          }
        ]}
        disabled={disabled}
      />
      <BCFormRadio
        control={control}
        name="idirRole"
        options={idirRoleOptions(t)}
        disabled={disabled}
      />
    </Box>
  )
}
