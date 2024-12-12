import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShareFromSquare } from '@fortawesome/free-solid-svg-icons'

const WebsiteCard = () => {
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
      <BCTypography
        style={{
          fontSize: '18px',
          color: '#003366',
          marginBottom: '12px',
          textAlign: 'center'
        }}
        gutterBottom
      >
        <strong>{t('dashboard:website.title')}</strong>
      </BCTypography>
      <BCTypography
        style={{
          fontSize: '16px',
          color: '#003366',
          textAlign: 'center'
        }}
      >
        {t('dashboard:website.linkText')}
        <br />
        <a
          href="http://gov.bc.ca/lowcarbonfuels"
          target="_blank"
          rel="noopener noreferrer"
          title={t('dashboard:website.linkTooltip')}
        >
          {t('dashboard:website.linkUrl')}
          <FontAwesomeIcon
            icon={faShareFromSquare}
            style={{
              marginLeft: '6px',
              color: '#578260'
            }}
          />
        </a>
      </BCTypography>
    </Box>
  )
}

export default WebsiteCard
