import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { CommonArrayRenderer } from '@/utils/grid/cellRenderers'
import { useTranslation } from 'react-i18next'
export const ChargingSiteProfile = () => {
  const { t } = useTranslation('chargingSite')

  return (
    <BCBox p={1}>
      <BCTypography variant="h6" color="primary">
        {'The Bay'} {/* Site Name */}
      </BCTypography>
      <BCBox
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: '1fr 3fr' }}
        columnGap={10}
        rowGap={2}
        mt={1}
      >
        {/* Left Column */}
        <BCBox display="flex" flexDirection="column" gap={1}>
          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.status')}:
            </BCTypography>{' '}
            {' Validated'}
          </BCTypography>

          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.version')}:
            </BCTypography>
            {' 1'}
          </BCTypography>

          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.siteNum')}:
            </BCTypography>{' '}
            {' 00321'}
          </BCTypography>
        </BCBox>

        {/* Right Column */}
        <BCBox display="flex" flexDirection="column" gap={0}>
          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.siteAddr')}:
            </BCTypography>
            {' 123 Douglas St., Victoria B.C., V8Z 0B1'}
          </BCTypography>

          <BCTypography
            variant="body4"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 1,
              '& > div': {
                margin: 0,
                width: { xs: '200px', md: '350px' }
              }
            }}
          >
            <BCTypography variant="label">
              {t('cardLabels.intendedUserTypes')}:
            </BCTypography>{' '}
            <CommonArrayRenderer
              value={['Multi-unit residential building', 'Employee']}
              disableLink={true}
            />
          </BCTypography>

          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.notes')}:
            </BCTypography>
            {' NE Corner'}
          </BCTypography>
        </BCBox>
      </BCBox>
    </BCBox>
  )
}
