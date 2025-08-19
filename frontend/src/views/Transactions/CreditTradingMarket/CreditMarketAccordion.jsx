import React, { useState } from 'react'
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box
} from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'

export const CreditMarketAccordion = () => {
  const { t } = useTranslation(['common', 'creditMarket'])
  const [expanded, setExpanded] = useState(true)

  const handleChange = (event, isExpanded) => {
    setExpanded(isExpanded)
  }

  return (
    <Accordion expanded={expanded} onChange={handleChange}>
      <AccordionSummary
        expandIcon={<ExpandMore />}
        aria-controls="credit-market-info-content"
        id="credit-market-info-header"
      >
        <BCTypography variant="h5" sx={{ color: 'primary.main' }}>
          {t('creditMarket:informationBulletin')}
        </BCTypography>
      </AccordionSummary>

      <AccordionDetails>
        <Box>
          <BCTypography
            variant="h6"
            gutterBottom
            sx={{ mt: 0, mb: 2, color: 'primary.main' }}
          >
            {t('creditMarket:background')}
          </BCTypography>

          <BCTypography variant="body2" paragraph>
            {t('creditMarket:backgroundText1')}
          </BCTypography>

          <BCTypography variant="body2" paragraph>
            {t('creditMarket:backgroundText2')}
          </BCTypography>

          <BCTypography variant="body2" paragraph>
            {t('creditMarket:backgroundText3')}
          </BCTypography>

          <BCTypography
            variant="h6"
            gutterBottom
            sx={{ mt: 3, mb: 2, color: 'primary.main' }}
          >
            {t('creditMarket:complianceUnitsIssued')}
          </BCTypography>

          <BCTypography variant="body2" paragraph>
            {t('creditMarket:complianceUnitsText')}
          </BCTypography>

          <BCTypography
            variant="h6"
            gutterBottom
            sx={{ mt: 3, mb: 2, color: 'primary.main' }}
          >
            {t('creditMarket:fairMarketValue')}
          </BCTypography>

          <BCTypography variant="body2" paragraph>
            {t('creditMarket:fairMarketValueText1')}
          </BCTypography>

          <BCTypography variant="body2" paragraph>
            {t('creditMarket:fairMarketValueText2')}
          </BCTypography>

          <BCTypography
            variant="h6"
            gutterBottom
            sx={{ mt: 3, mb: 2, color: 'primary.main' }}
          >
            {t('creditMarket:approvalOfTransfers')}
          </BCTypography>

          <BCTypography variant="body2" paragraph>
            {t('creditMarket:approvalOfTransfersText')}
          </BCTypography>

          <BCTypography
            variant="h6"
            gutterBottom
            sx={{ mt: 3, mb: 2, color: 'primary.main' }}
          >
            {t('creditMarket:applicationOfCredits')}
          </BCTypography>

          <BCTypography variant="body2" paragraph>
            {t('creditMarket:applicationOfCreditsText')}
          </BCTypography>

          <BCTypography
            variant="h6"
            gutterBottom
            sx={{ mt: 3, mb: 2, color: 'primary.main' }}
          >
            {t('creditMarket:needMoreInformation')}
          </BCTypography>

          <BCTypography variant="body2" paragraph>
            {t('creditMarket:needMoreInformationText')}
          </BCTypography>

          <BCTypography variant="body2" paragraph>
            {t('creditMarket:legalDisclaimer')}
          </BCTypography>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
