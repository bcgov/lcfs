import { Box } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { BCFormCheckbox, BCFormRadio } from '@/components/BCForm'
import { govRoles } from '@/constants/roles'
import { idirRoleOptions } from '../_schema'

export const IDIRSpecificRoleFields = ({ form, disabled, t }) => {
  const { control } = form
  return (
    <Box>
      <BCTypography variant="label" component="div">
        {t('admin:Roles')}
      </BCTypography>
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
