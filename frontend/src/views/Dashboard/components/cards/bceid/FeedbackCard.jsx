import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Icon } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { Mail } from '@mui/icons-material'

const FeedbackCard = () => {
  const { t } = useTranslation(['dashboard'])

  return (
    <Box
      p={2}
      paddingTop={4}
      paddingBottom={4}
      bgcolor="background.grey"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <Icon sx={{ color: '#547D59', fontSize: 60 }}>
        <Mail />
      </Icon>
      <BCTypography
        style={{
          fontSize: '18px',
          color: '#003366',
          marginBottom: '12px',
          textAlign: 'center'
        }}
        gutterBottom
      >
        <strong>{t('dashboard:feedback.title')}</strong>
      </BCTypography>
      <BCTypography
        style={{ fontSize: '16px', color: '#003366', textAlign: 'center' }}
        color="link"
        dangerouslySetInnerHTML={{ __html: t('dashboard:feedback.email') }}
      ></BCTypography>
    </Box>
  )
}

export default FeedbackCard
