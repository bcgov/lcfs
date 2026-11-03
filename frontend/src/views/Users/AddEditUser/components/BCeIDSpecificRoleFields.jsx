import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import { Controller } from 'react-hook-form'
import { BCFormCheckbox } from '@/components/BCForm/BCFormCheckbox'
import { CustomLabel } from '@/components/BCForm/CustomLabel'
import { roles } from '@/constants/roles'
import {
  bceidRoleOptions,
  iaSignerOption,
  lcjfipAdministratorOption
} from '../_schema'

// Government-assigned roles rendered indented directly under their parent
// role. A parent option is only offered when the organization has it
// available, so its dependent follows the same availability.
const dependentRoleDefinitions = (t) => [
  {
    id: 'ia-signer',
    option: iaSignerOption(t),
    parent: roles.ia_proponent.toLowerCase()
  },
  {
    id: 'lcjfip-administrator',
    option: lcjfipAdministratorOption(t),
    parent: roles.lcjfip_applicant.toLowerCase()
  }
]

// Split the main options so each dependent role can be rendered immediately
// after its parent rather than after the whole checkbox group.
const groupOptions = (options, dependents) => {
  const groups = []
  let current = []
  options.forEach((option) => {
    current.push(option)
    const dependent = dependents.find((d) => d.parent === option.value)
    if (dependent) {
      groups.push({ options: current, dependent })
      current = []
    }
  })
  if (current.length > 0) {
    groups.push({ options: current, dependent: null })
  }
  return groups
}

export const BCeIDSpecificRoleFields = ({
  form,
  disabled,
  t,
  isGovernmentUser = false,
  availableRoles = null
}) => {
  const { control, watch } = form
  const bceidRoles = watch('bceidRoles')
  const groups = groupOptions(
    bceidRoleOptions(t, availableRoles),
    dependentRoleDefinitions(t)
  )

  return (
    <Box>
      {groups.map(({ options, dependent }, index) => (
        <Box key={options[0]?.value ?? index}>
          <BCFormCheckbox
            form={form}
            name="bceidRoles"
            label={index === 0 ? t('admin:Roles') : undefined}
            options={options}
            disabled={disabled}
          />

          {/*
           * Dependent roles are disabled unless their parent is checked and
           * only government (IDIR) users can assign them.
           */}
          {isGovernmentUser && dependent && (
            <FormControl component="fieldset" sx={{ ml: 4, mt: -0.5 }}>
              <FormControlLabel
                sx={{ marginY: 1 }}
                control={
                  <Controller
                    name="bceidRoles"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Checkbox
                        id={dependent.id}
                        sx={{ marginTop: 0.5 }}
                        checked={
                          value?.includes(dependent.option.value) ?? false
                        }
                        onChange={() => {
                          if (value?.includes(dependent.option.value)) {
                            onChange(
                              value.filter((v) => v !== dependent.option.value)
                            )
                          } else {
                            onChange([...(value ?? []), dependent.option.value])
                          }
                        }}
                        disabled={
                          disabled || !bceidRoles?.includes(dependent.parent)
                        }
                      />
                    )}
                  />
                }
                label={
                  <CustomLabel
                    header={dependent.option.header}
                    text={dependent.option.text}
                  />
                }
              />
            </FormControl>
          )}
        </Box>
      ))}
    </Box>
  )
}
