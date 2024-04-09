import { Box, FormControlLabel, Checkbox, Typography } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import withRole from '@/utils/withRole'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

const SigningAuthority = () => {
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
          control={
            <Checkbox
              {...register('signingAuthorityDeclaration')}
              id="signing-authority-declaration"
              color="primary"
              defaultChecked={false}
            />
          }
          label={
            <Typography variant="body2">
              {t('transfer:saConfirmation')}
            </Typography>
          }
        />
        {errors.signingAuthorityDeclaration && (
          <Typography color="error" variant="caption">
            {errors.signingAuthorityDeclaration.message}
          </Typography>
        )}
      </Box>
    </>
  )
}

const AllowedRoles = ['Signing Authority']
const SigningAuthorityWithRole = withRole(SigningAuthority, AllowedRoles)

export default SigningAuthorityWithRole
