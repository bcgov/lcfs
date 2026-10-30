import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import { Controller } from 'react-hook-form'
import { BCFormCheckbox } from '@/components/BCForm/BCFormCheckbox'
import { CustomLabel } from '@/components/BCForm/CustomLabel'
import { roles } from '@/constants/roles'
import {
  allowedBceidRoleValues,
  bceidRoleOptions,
  iaSignerOption,
  lcjfipAdministratorOption
} from '../_schema'

export const BCeIDSpecificRoleFields = ({
  form,
  disabled,
  t,
  isGovernmentUser = false,
  isLcjfipOrganization = false,
  availableRoles = null
}) => {
  const { control, watch } = form
  const bceidRoles = watch('bceidRoles')
  const hasProponent = bceidRoles?.includes(roles.ia_proponent.toLowerCase())
  const signerOpt = iaSignerOption(t)
  const allowed = allowedBceidRoleValues(
    availableRoles,
    isLcjfipOrganization,
    isGovernmentUser
  )
  const signerAvailable =
    allowed == null || allowed.includes(roles.ia_signer.toLowerCase())
  const lcjfipAdminOpt = lcjfipAdministratorOption(t)

  return (
    <Box>
      <BCFormCheckbox
        form={form}
        name="bceidRoles"
        label={t('admin:Roles')}
        options={bceidRoleOptions(t, availableRoles, isLcjfipOrganization)}
        disabled={disabled}
      />

      {/*
       * IA Signer is indented under IA Proponent and disabled unless IA Proponent
       * is checked — only government (IDIR) users can assign this role, and only
       * when IA Proponent is available to the organization.
       */}
      {isGovernmentUser && signerAvailable && (
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

      {isGovernmentUser && isLcjfipOrganization && (
        <FormControl component="fieldset" sx={{ mt: 1 }}>
          <FormControlLabel
            sx={{ marginY: 1 }}
            control={
              <Controller
                name="bceidRoles"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Checkbox
                    id="lcjfip-administrator"
                    sx={{ marginTop: 0.5 }}
                    checked={value?.includes(lcjfipAdminOpt.value) ?? false}
                    onChange={() => {
                      if (value?.includes(lcjfipAdminOpt.value)) {
                        onChange(
                          value.filter((v) => v !== lcjfipAdminOpt.value)
                        )
                      } else {
                        onChange([...(value ?? []), lcjfipAdminOpt.value])
                      }
                    }}
                    disabled={disabled}
                  />
                )}
              />
            }
            label={
              <CustomLabel
                header={lcjfipAdminOpt.header}
                text={lcjfipAdminOpt.text}
              />
            }
          />
        </FormControl>
      )}
    </Box>
  )
}
