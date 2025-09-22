import { Box } from '@mui/material'
import { BCFormCheckbox, BCFormRadio } from '@/components/BCForm'
import { nonGovRoles } from '@/constants/roles'
import { bceidRoleOptions } from '../_schema'

export const BCeIDSpecificRoleFields = ({ form, disabled, t }) => {
  const { control } = form
  return (
    <Box>
      <BCFormCheckbox
        form={form}
        name="bceidRoles"
        label={t('admin:Roles')}
        options={bceidRoleOptions(t)}
        disabled={disabled}
      />

      {/* "Read only" */}
      {/* <BCFormRadio
        id={nonGovRoles[5].toLowerCase().replace(' ', '-')}
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
        disabled={disabled}
      /> */}
    </Box>
  )
}
