import { Box, Typography } from '@mui/material'
import { BCFormCheckbox, BCFormRadio } from '@/components/BCForm'
import { nonGovRoles } from '@/constants/roles'
import { bceidRoleOptions } from '../_schema'

export const BCeIDSpecificRoleFields = ({ form, disabled, t, status }) => {
  const { control } = form
  return (
    <Box>
      <Typography variant="label" component="span">
        {t('admin:Roles')}
      </Typography>
      <BCFormCheckbox
        form={form}
        name="bceidRoles"
        options={bceidRoleOptions(t)}
        disabled={disabled}
      />
      <BCFormRadio
        control={control}
        name="readOnly"
        options={[
          {
            label: nonGovRoles[5],
            header: nonGovRoles[5],
            text: t(
              `admin:userForm.${nonGovRoles[5].toLowerCase().replace(' ', '_')}`
            ),
            value: nonGovRoles[5].toLowerCase()
          }
        ]}
        disabled={status === 'inactive' && disabled}
      />
    </Box>
  )
}
