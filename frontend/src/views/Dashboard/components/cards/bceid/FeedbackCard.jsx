import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Icon } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import MailIcon from '@mui/icons-material/Mail';

const FeedbackCard = () => {
  const { t } = useTranslation(['common'])

  return (
    <Box p={2} paddingTop={4} paddingBottom={4} bgcolor="background.grey" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
      <Icon sx={{ color: '#578260', fontSize: 60 }}>
        <MailIcon />
      </Icon>
      <BCTypography style={{ fontSize: '18px', color: '#003366', marginBottom: '12px', textAlign: 'center' }} gutterBottom>
        <strong>{t('common:cards.feedback.title')}</strong>
      </BCTypography>
      <BCTypography
        style={{ fontSize: '16px', color: '#003366', textAlign: 'center' }}
        color="link"
        dangerouslySetInnerHTML={{ __html:t('common:cards.feedback.email')}}
      ></BCTypography>
    </Box>
  )
}

export default FeedbackCard