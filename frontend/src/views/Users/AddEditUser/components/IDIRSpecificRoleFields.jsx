import {
  Box,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup
} from '@mui/material'
import { Controller } from 'react-hook-form'
import BCTypography from '@/components/BCTypography'
import { BCFormCheckbox, BCFormRadio } from '@/components/BCForm'
import { CustomLabel } from '@/components/BCForm/CustomLabel'
import { roles } from '@/constants/roles'
import { adminRoleOptions, iaRoleOptions } from '../_schema'

export const IDIRSpecificRoleFields = ({ form, disabled, t }) => {
  const { control, watch } = form
  const idirRole = watch('idirRole')
  const isDirector = idirRole === roles.director.toLowerCase()

  return (
    <Box>
      <BCTypography variant="label" component="div">
        {t('admin:Roles')}
      </BCTypography>

      <BCFormCheckbox
        name="adminRole"
        form={form}
        options={adminRoleOptions(t)}
        disabled={disabled}
      />

      <FormControl component="fieldset" sx={{ mt: 1.5, width: '100%' }}>
        <Controller
          name="idirRole"
          control={control}
          render={({ field: { onChange, value } }) => (
            <RadioGroup
              value={value}
              onChange={onChange}
              style={{ gap: 8, marginTop: 8 }}
            >
              <FormControlLabel
                value={roles.director.toLowerCase()}
                label={
                  <CustomLabel
                    header={roles.director}
                    text={t('admin:userForm.director')}
                  />
                }
                control={<Radio sx={{ marginTop: 0.5 }} disabled={disabled} />}
              />

              <BCTypography
                variant="label"
                component="div"
                sx={{ mt: 1, mb: 0 }}
              >
                {t('admin:userForm.complianceSection')}
              </BCTypography>

              <FormControlLabel
                value={roles.analyst.toLowerCase()}
                label={
                  <CustomLabel
                    header={roles.analyst}
                    text={t('admin:userForm.analyst')}
                  />
                }
                control={<Radio sx={{ marginTop: 0.5 }} disabled={disabled} />}
              />

              <FormControlLabel
                value={roles.compliance_manager.toLowerCase()}
                label={
                  <CustomLabel
                    header={roles.compliance_manager}
                    text={t('admin:userForm.compliance_manager')}
                  />
                }
                control={<Radio sx={{ marginTop: 0.5 }} disabled={disabled} />}
              />
            </RadioGroup>
          )}
        />
      </FormControl>

      <BCTypography variant="label" component="div" sx={{ mt: 2, mb: 0 }}>
        {t('admin:userForm.initiativeAgreementsSection')}
      </BCTypography>
      <BCFormRadio
        control={control}
        name="iaRole"
        options={iaRoleOptions(t)}
        disabled={disabled}
      />
    </Box>
  )
}
