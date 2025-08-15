import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { phoneNumberFormatter } from '@/utils/formatters'
import { RoleSpanRenderer, StatusRenderer } from '@/utils/grid/cellRenderers'
import { useTranslation } from 'react-i18next'

export const UserProfile = ({ data }) => {
  const { t } = useTranslation(['common', 'admin'])
  return (
    <BCBox p={1}>
      <BCBox
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}
        columnGap={{ xs: 0, md: 10 }}
        rowGap={2}
      >
        {/* Left Column */}
        <BCBox display="flex" flexDirection="column" gap={1}>
          <BCTypography variant="body4">
            <strong>{t('Name')}:</strong> {data.firstName} {data.lastName}
          </BCTypography>
          <BCTypography variant="body4">
            <strong>{t('admin:Title')}:</strong> {data.title}
          </BCTypography>
          <BCTypography variant="body4">
            <strong>{t('Organization')}:</strong>{' '}
            {data.organization?.name || t('govOrg')}
          </BCTypography>
          <BCTypography variant="body4">
            <strong>{t('Status')}:</strong>{' '}
            {StatusRenderer({ data, isView: true })}
          </BCTypography>
          <BCTypography variant="body4">
            <strong>{t('Roles')}:</strong> {RoleSpanRenderer({ data })}
          </BCTypography>
        </BCBox>

        {/* Right Column */}
        <BCBox display="flex" flexDirection="column" gap={1}>
          <BCTypography variant="body4">
            <strong>{t('admin:Email')}:</strong> {data.keycloakEmail}
          </BCTypography>
          <BCTypography variant="body4">
            <strong>{t('admin:WorkPhone')}:</strong>{' '}
            {phoneNumberFormatter({ value: data.phone })}
          </BCTypography>
          <BCTypography variant="body4">
            <strong>{t('admin:MobilePhone')}:</strong>{' '}
            {phoneNumberFormatter({ value: data.mobilePhone })}
          </BCTypography>
        </BCBox>
      </BCBox>
    </BCBox>
  )
}
