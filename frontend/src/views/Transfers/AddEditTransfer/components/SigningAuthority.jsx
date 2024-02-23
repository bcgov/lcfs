import { Box, FormControlLabel, Checkbox, Typography } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import withRole from '@/utils/withRole'
import { useFormContext } from 'react-hook-form'

const SigningAuthority = () => {
  const {
    register,
    formState: { errors }
  } = useFormContext()
  return (
    <>
      <BCTypography variant={'h6'} mt={2} mb={2} color={'primary'}>
        Signing Authority Declaration
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
              color="primary"
              defaultChecked={false}
            />
          }
          label={
            <Typography variant="body2">
              I confirm that records evidencing each matter reported under
              section 18 of the Low Carbon Fuel (General) Regulation are
              available on request.
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
