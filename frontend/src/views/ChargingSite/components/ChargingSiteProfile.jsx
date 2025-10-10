import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { useGetChargingSiteById } from '@/hooks/useChargingSite'
import { constructAddress } from '@/utils/constructAddress'
import {
  CommonArrayRenderer,
  createStatusRenderer
} from '@/utils/grid/cellRenderers'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

export const ChargingSiteProfile = ({ alertRef = useRef(null), data }) => {
  const { t } = useTranslation('chargingSite')

  const { streetAddress, city, postalCode } = data
  return (
    <BCBox p={1}>
      <BCTypography variant="h6" color="primary">
        {data?.siteName || ''}
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
          <BCBox sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BCTypography variant="label">
              {t('cardLabels.status')}:
            </BCTypography>{' '}
            {createStatusRenderer(
              {
                Draft: 'info',
                Updated: 'info',
                Submitted: 'warning',
                Validated: 'success',
                Decommissioned: 'smoky'
              },
              {},
              data?.status?.status || ''
            )({ data })}
          </BCBox>

          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.version')}:
            </BCTypography>{' '}
            {String(data?.version) || ''}
          </BCTypography>

          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.siteNum')}:
            </BCTypography>{' '}
            {data?.siteCode || ''}
          </BCTypography>
        </BCBox>

        {/* Right Column */}
        <BCBox display="flex" flexDirection="column" gap={0}>
          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.siteAddr')}:
            </BCTypography>{' '}
            {[streetAddress, city, postalCode].join(', ')}
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
              value={data?.intendedUsers?.map((i) => i.typeName)}
              disableLink={true}
            />
          </BCTypography>

          <BCTypography variant="body4">
            <BCTypography variant="label">
              {t('cardLabels.notes')}:
            </BCTypography>{' '}
            {data?.notes}
          </BCTypography>
        </BCBox>
      </BCBox>
      <Role roles={[roles.government]}>
        <BCTypography variant="body4">
          <BCTypography variant="label">
            {t('cardLabels.organization')}:
          </BCTypography>{' '}
          {data?.organization?.name || ''}
        </BCTypography>
      </Role>
    </BCBox>
  )
}
