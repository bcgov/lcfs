import {
  Box,
  Button,
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

const resetButtonSx = {
  display: 'block',
  textTransform: 'none',
  mt: 1,
  px: 1.25,
  py: 0.25,
  height: 28,
  minHeight: 28,
  minWidth: 0,
  fontSize: '0.8125rem',
  fontWeight: 400,
  lineHeight: 1.2,
  borderColor: 'primary.main',
  color: 'primary.main',
  backgroundColor: 'white.main'
}

export const IDIRSpecificRoleFields = ({ form, disabled, t }) => {
  const { control, watch, setValue } = form
  const idirRole = watch('idirRole')
  const iaRole = watch('iaRole')

  const handleResetComplianceRoles = () => {
    setValue('idirRole', '')
  }

  const handleResetIARoles = () => {
    setValue('iaRole', '')
  }

  const hasComplianceRole = idirRole !== ''
  const hasIARole = iaRole !== ''

  return (
    <Box>
      <BCTypography variant="label" component="div" mb={1}>
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

      <Button
        variant="outlined"
        size="small"
        color="primary"
        onClick={handleResetComplianceRoles}
        disabled={disabled || !hasComplianceRole}
        data-test="reset-compliance-roles-btn"
        sx={resetButtonSx}
      >
        {t('admin:userForm.resetRoles')}
      </Button>

      <BCTypography variant="label" component="div" sx={{ mt: 2, mb: 0 }}>
        {t('admin:userForm.initiativeAgreementsSection')}
      </BCTypography>
      <BCFormRadio
        control={control}
        name="iaRole"
        options={iaRoleOptions(t)}
        disabled={disabled}
        sx={{ width: '100%', display: 'block' }}
      />

      <Button
        variant="outlined"
        size="small"
        color="primary"
        onClick={handleResetIARoles}
        disabled={disabled || !hasIARole}
        data-test="reset-ia-roles-btn"
        sx={resetButtonSx}
      >
        {t('admin:userForm.resetRoles')}
      </Button>
    </Box>
  )
}
