import { Link } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'

export const Unauthorized = () => {
  const { t } = useTranslation('common')

  return (
    <BCBox
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
    >
      <BCTypography
        variant="h1"
        sx={{ fontWeight: 'bold', color: '#003366', mb: 2 }}
      >
        {t('unauthorized.title')}
      </BCTypography>

      <BCTypography variant="body2" sx={{ fontWeight: 'bold', maxWidth: 700 }}>
        {t('unauthorized.message')}
        <br />
        {t('unauthorized.contact')}{' '}
        <Link
          href={`mailto:${t('unauthorized.email')}`}
          underline="always"
          sx={{
            color: '#003366',
            fontWeight: 'bold'
          }}
        >
          {t('unauthorized.email')}
        </Link>
      </BCTypography>
    </BCBox>
  )
}
