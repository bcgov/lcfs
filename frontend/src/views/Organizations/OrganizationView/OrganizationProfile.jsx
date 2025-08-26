import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ORGANIZATION_STATUSES } from '@/constants/statuses'
import { useTranslation } from 'react-i18next'
import { phoneNumberFormatter } from '@/utils/formatters'
import { constructAddress } from '@/utils/constructAddress'
import { CURRENT_COMPLIANCE_YEAR } from '@/constants/common'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { LinkKeyManagement } from './components/LinkKeyManagement'

export const OrganizationProfile = ({
  hasRoles,
  isCurrentUserLoading,
  orgID,
  orgData,
  orgBalanceInfo
}) => {
  const { t } = useTranslation()

  return (
    <BCBox p={1}>
      <BCBox
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}
        columnGap={10}
        rowGap={2}
      >
        {/* Left Column */}
        <BCBox display="flex" flexDirection="column" gap={2}>
          <BCTypography variant="body4">
            <strong>{t('org:legalNameLabel')}:</strong> {orgData?.name}
          </BCTypography>

          <BCTypography variant="body4">
            <strong>{t('org:operatingNameLabel')}:</strong>{' '}
            {orgData?.operatingName || orgData?.name}
          </BCTypography>

          <BCTypography variant="body4">
            <strong>{t('org:phoneNbrLabel')}:</strong>{' '}
            {phoneNumberFormatter({ value: orgData?.phone })}
          </BCTypography>

          <BCTypography variant="body4">
            <strong>{t('org:emailAddrLabel')}:</strong> {orgData?.email}
          </BCTypography>

          <Role roles={[roles.government]}>
            <BCTypography variant="body4">
              <strong>{t('org:complianceUnitBalance')}:</strong>{' '}
              {orgBalanceInfo?.totalBalance?.toLocaleString()} (
              {Math.abs(orgBalanceInfo?.reservedBalance || 0).toLocaleString()})
            </BCTypography>
          </Role>
        </BCBox>

        {/* Right Column */}
        <BCBox display="flex" flexDirection="column" gap={2}>
          <BCTypography variant="body4">
            <strong>{t('org:serviceAddrLabel')}:</strong>{' '}
            {orgData && constructAddress(orgData.orgAddress)}
          </BCTypography>

          <BCTypography variant="body4">
            <strong>{t('org:bcAddrLabel')}:</strong>{' '}
            {orgData && constructAddress(orgData.orgAttorneyAddress)}
          </BCTypography>
          {orgData?.recordsAddress && (
            <BCTypography variant="body4">
              <strong>{t('org:bcRecordLabelShort')}:</strong>{' '}
              {orgData?.recordsAddress}
            </BCTypography>
          )}

          <BCTypography variant="body4">
            <strong>{t('org:regTrnLabel')}:</strong>{' '}
            {orgData?.orgStatus.status === ORGANIZATION_STATUSES.REGISTERED
              ? t('org:registeredTransferYes')
              : t('org:registeredTransferNo')}
          </BCTypography>

          {(hasRoles(roles.government) || orgData?.hasEarlyIssuance) && (
            <BCTypography variant="body4">
              <strong>
                {t('org:earlyIssuanceIndicator', {
                  year: CURRENT_COMPLIANCE_YEAR
                })}
                :
              </strong>{' '}
              {orgData?.hasEarlyIssuance ? t('common:yes') : t('common:no')}
            </BCTypography>
          )}
          {isFeatureEnabled(FEATURE_FLAGS.OBFUSCATED_LINKS) && (
            <Role roles={[roles.analyst]}>
              <BCBox>
                <LinkKeyManagement orgData={orgData} orgID={orgID} />
              </BCBox>
            </Role>
          )}
        </BCBox>
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
