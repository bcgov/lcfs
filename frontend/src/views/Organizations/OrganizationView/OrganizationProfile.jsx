import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import '@/components/Loading'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { formatOrgAvailableRoles } from '@/constants/organizationRoles'
import { ORGANIZATION_STATUSES } from '@/constants/statuses'
import { useTranslation } from 'react-i18next'
import { phoneNumberFormatter } from '@/utils/formatters'
import { constructAddress } from '@/utils/constructAddress'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { LinkKeyManagement } from './components/LinkKeyManagement'
import { EarlyIssuanceToggle } from './components/EarlyIssuanceToggle'
import Divider from '@mui/material/Divider'
import { SettingRow } from './components/SettingRow'
import { RepresentativeAgreement } from './components/RepresentativeAgreement'

// Each column is a two-track grid (label | value), so every value in a column
// starts at the same position, set by that column's longest label. The field
// wrappers use display: contents so their label and value become grid cells.
const columnSx = {
  display: 'grid',
  gridTemplateColumns: 'max-content minmax(0, 1fr)',
  columnGap: 1,
  rowGap: 0.5,
  alignItems: 'baseline',
  alignContent: 'start'
}
const fieldSx = { display: 'contents', '& > strong': { whiteSpace: 'nowrap' } }

export const OrganizationProfile = ({
  hasRoles,
  isCurrentUserLoading,
  orgID,
  orgData,
  orgBalanceInfo
}) => {
  const { t } = useTranslation()
  // Only Compliance Managers and Directors may change early issuance; the API
  // enforces the same rule.
  const canEditEarlyIssuance =
    hasRoles(roles.compliance_manager) || hasRoles(roles.director)
  // Analysts, Compliance Managers and Directors may record a representative
  // agreement; the API enforces the same rule.
  const canEditRepresentativeAgreement =
    hasRoles(roles.analyst) ||
    hasRoles(roles.compliance_manager) ||
    hasRoles(roles.director)

  return (
    <BCBox p={1}>
      <BCBox
        display="grid"
        gridTemplateColumns={{
          xs: '1fr',
          md: 'minmax(0, 8fr) minmax(0, 12fr)'
        }}
        columnGap={4}
        rowGap={1}
      >
        {/* Left Column */}
        <BCBox sx={columnSx}>
          <BCTypography variant="body4" sx={fieldSx}>
            <strong>{t('org:legalNameLabel')}:</strong> {orgData?.name}
          </BCTypography>

          <BCTypography variant="body4" sx={fieldSx}>
            <strong>{t('org:operatingNameLabel')}:</strong>{' '}
            {orgData?.operatingName || orgData?.name}
          </BCTypography>

          {orgData?.contactName && (
            <BCTypography variant="body4" sx={fieldSx}>
              <strong>{t('org:contactNameLabel')}:</strong>{' '}
              {orgData.contactName}
            </BCTypography>
          )}

          <BCTypography variant="body4" sx={fieldSx}>
            <strong>{t('org:phoneNbrLabel')}:</strong>{' '}
            {phoneNumberFormatter({ value: orgData?.phone })}
          </BCTypography>

          <BCTypography variant="body4" sx={fieldSx}>
            <strong>{t('org:emailAddrLabel')}:</strong> {orgData?.email}
          </BCTypography>

          <BCTypography variant="body4" sx={fieldSx}>
            <strong>{t('org:edrmsNumberLabel')}:</strong>{' '}
            {orgData?.edrmsRecord || t('org:noInformationProvided')}
          </BCTypography>

          <Role roles={[roles.government]}>
            <BCTypography variant="body4" sx={fieldSx}>
              <strong>{t('org:complianceUnitBalance')}:</strong>{' '}
              {orgBalanceInfo?.totalBalance?.toLocaleString()} (
              {Math.abs(orgBalanceInfo?.reservedBalance || 0).toLocaleString()})
            </BCTypography>
          </Role>
        </BCBox>

        {/* Right Column */}
        <BCBox sx={columnSx}>
          <BCTypography variant="body4" sx={fieldSx}>
            <strong>{t('org:serviceAddrLabel')}:</strong>{' '}
            {orgData && constructAddress(orgData.orgAddress)}
          </BCTypography>

          <BCTypography variant="body4" sx={fieldSx}>
            <strong>{t('org:bcAddrLabel')}:</strong>{' '}
            {orgData && constructAddress(orgData.orgAttorneyAddress)}
          </BCTypography>

          {orgData?.recordsAddress && (
            <BCTypography variant="body4" sx={fieldSx}>
              <strong>{t('org:bcRecordLabelShort')}:</strong>{' '}
              {orgData?.recordsAddress}
            </BCTypography>
          )}

          <BCTypography variant="body4" sx={fieldSx}>
            <strong>{t('org:orgTypeLabel')}:</strong>{' '}
            {(orgData?.orgTypes?.length
              ? orgData.orgTypes
              : orgData?.orgType
                ? [orgData.orgType]
                : []
            )
              .map((type) => type.description || type.orgType)
              .join(', ')}
          </BCTypography>

          <BCTypography variant="body4" sx={fieldSx}>
            <strong>{t('org:rolesAvailableLabel')}:</strong>{' '}
            {formatOrgAvailableRoles(orgData?.availableRoles) || '—'}
          </BCTypography>
        </BCBox>
      </BCBox>

      <Divider sx={{ my: 2.5 }} />

      {/* Full-width settings rows */}
      <BCBox display="flex" flexDirection="column" gap={1.5}>
        <SettingRow label={t('org:regTrnLabel')}>
          <BCTypography variant="body4">
            {orgData?.orgStatus.status === ORGANIZATION_STATUSES.REGISTERED
              ? t('org:registeredTransferYes')
              : t('org:registeredTransferNo')}
          </BCTypography>
        </SettingRow>
        {(hasRoles(roles.government) || orgData?.hasEarlyIssuance) && (
          <EarlyIssuanceToggle
            orgID={orgID}
            hasEarlyIssuance={orgData?.hasEarlyIssuance}
            canEdit={canEditEarlyIssuance}
          />
        )}
        <RepresentativeAgreement
          orgID={orgID}
          hasRepresentativeAgreement={orgData?.hasRepresentativeAgreement}
          representativeOrganizationName={
            orgData?.representativeOrganizationName
          }
          canEdit={canEditRepresentativeAgreement}
        />
        {isFeatureEnabled(FEATURE_FLAGS.OBFUSCATED_LINKS) && (
          <Role roles={[roles.analyst]}>
            <LinkKeyManagement orgData={orgData} orgID={orgID} />
          </Role>
        )}
      </BCBox>
      {!isCurrentUserLoading && !hasRoles(roles.government) && (
        <BCBox mt={2}>
          <BCTypography variant="body4">
            {t('org:toUpdateMsgPrefix')}{' '}
            <a href={`mailto:${t('lcfsEmail')}`}>{t('lcfsEmail')}</a>{' '}
            {t('org:toUpdateMsgSuffix')}
          </BCTypography>
        </BCBox>
      )}
    </BCBox>
  )
}
