import { Checkbox, FormControlLabel, Radio, RadioGroup } from '@mui/material'
import { useTranslation } from 'react-i18next'

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
        control={<Checkbox {...register('roles')} data-test="roleAdmin" />}
        label={
          <span>
            <strong>{t('userForm.admin')}</strong> — {t('userForm.adminRole')}
          </span>
        }
        onChange={handleCheckbox}
        name="administrator"
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
        <FormControlLabel
          value="analyst"
          control={<Radio />}
          style={{
            '.MuiFormControlLabel-label': {
              fontSize: 16
            }
          }}
          label={
            <span>
              <strong>{t('userForm.analyst')}</strong> —{' '}
              {t('userForm.analystRole')}
            </span>
          }
          disabled={formData.active === 'inactive'}
        />
        <FormControlLabel
          value="compliance_manager"
          control={<Radio />}
          label={
            <span>
              <strong>{t('userForm.cMgr')}</strong> — {t('userForm.cMgrRole')}
            </span>
          }
          disabled={formData.active === 'inactive'}
        />
        <FormControlLabel
          value="director"
          control={<Radio />}
          label={
            <span>
              <strong>{t('userForm.director')}</strong> —{' '}
              {t('userForm.directorRole')}
            </span>
          }
          disabled={formData.active === 'inactive'}
        />
      </RadioGroup>
    </>
  )
}
