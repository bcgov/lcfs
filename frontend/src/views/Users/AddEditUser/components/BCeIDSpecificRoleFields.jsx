import { Box, Checkbox, FormControl, FormControlLabel } from '@mui/material'
import { Controller } from 'react-hook-form'
import { BCFormCheckbox } from '@/components/BCForm'
import { CustomLabel } from '@/components/BCForm/CustomLabel'
import { roles } from '@/constants/roles'
import { bceidRoleOptions, iaSignerOption } from '../_schema'

export const BCeIDSpecificRoleFields = ({
  form,
  disabled,
  t,
  isGovernmentUser = false
}) => {
  const { control, watch } = form
  const bceidRoles = watch('bceidRoles')
  const hasProponent = bceidRoles?.includes(roles.ia_proponent.toLowerCase())
  const signerOpt = iaSignerOption(t)

  return (
    <Box>
      <BCFormCheckbox
        form={form}
        name="bceidRoles"
        label={t('admin:Roles')}
        options={bceidRoleOptions(t)}
        disabled={disabled}
      />

      {/*
       * IA Signer is indented under IA Proponent and disabled unless IA Proponent
       * is checked — only government (IDIR) users can assign this role.
       */}
      {isGovernmentUser && (
        <FormControl component="fieldset" sx={{ ml: 4, mt: -0.5 }}>
          <FormControlLabel
            sx={{ marginY: 1 }}
            control={
              <Controller
                name="bceidRoles"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Checkbox
                    id="ia-signer"
                    sx={{ marginTop: 0.5 }}
                    checked={value?.includes(signerOpt.value) ?? false}
                    onChange={() => {
                      if (value?.includes(signerOpt.value)) {
                        onChange(value.filter((v) => v !== signerOpt.value))
                      } else {
                        onChange([...(value ?? []), signerOpt.value])
                      }
                    }}
                    disabled={disabled || !hasProponent}
                  />
                )}
              />
            }
            label={
              <CustomLabel header={signerOpt.header} text={signerOpt.text} />
            }
          />
        </FormControl>
      )}
    </Box>
  )
}
