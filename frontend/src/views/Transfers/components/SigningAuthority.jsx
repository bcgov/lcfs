import { Box, FormControlLabel, Checkbox } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import withRole from '@/utils/withRole'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

export const SigningAuthority = () => {
  const { t } = useTranslation(['transfer'])
  const {
    register,
    formState: { errors }
  } = useFormContext()
  return (
    <>
      <BCTypography variant={'h6'} mt={2} mb={2} color={'primary'}>
        {t('transfer:saLabel')}
      </BCTypography>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="flex-start"
        gap="10px"
        mx={2}
      >
        <FormControlLabel
          data-test="signing-authority"
          control={
            <Checkbox
              {...register('signingAuthorityDeclaration')}
              id="signing-authority-declaration"
              data-test="signing-authority-checkbox"
              color="primary"
              defaultChecked={false}
            />
          }
          label={
            <BCTypography variant="body2">
              {t('transfer:saConfirmation')}
            </BCTypography>
          }
        />
        {errors.signingAuthorityDeclaration && (
          <BCTypography color="error" variant="caption">
            {errors.signingAuthorityDeclaration.message}
          </BCTypography>
        )}
      </Box>
    </>
  )
}

const AllowedRoles = ['Signing Authority']
const SigningAuthorityWithRole = withRole(SigningAuthority, AllowedRoles)

export default SigningAuthorityWithRole
