import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { buildPath, ROUTES } from '@/routes/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useOrganization,
  useOrganizationBalance
} from '@/hooks/useOrganization'
import { phoneNumberFormatter } from '@/utils/formatters'
import { constructAddress } from '@/utils/constructAddress'
import { roles } from '@/constants/roles'
import { ORGANIZATION_STATUSES } from '@/constants/statuses'
import { Role } from '@/components/Role'
import { CURRENT_COMPLIANCE_YEAR } from '@/constants/common'

export const OrganizationDetailsCard = () => {
  const { t } = useTranslation(['common', 'org'])
  const location = useLocation()
  const { orgID } = useParams()

  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles
  } = useCurrentUser()

  const { data: orgData, isLoading } = useOrganization(
    orgID ?? currentUser?.organization?.organizationId,
    {
      staleTime: 0,
      cacheTime: 0
    }
  )
  const { data: orgBalanceInfo } = useOrganizationBalance(
    orgID ?? currentUser?.organization?.organizationId
  )

  const canEdit = hasRoles(roles.administrator)
  const editButtonRoute = canEdit
    ? buildPath(ROUTES.ORGANIZATIONS.EDIT, {
        orgID: orgID || currentUser?.organization?.organizationId
      })
    : null

  if (isLoading) {
    return <Loading />
  }

  return (
    <>
      <BCBox
        sx={{
          width: {
            md: '100%',
            lg: '90%'
          }
        }}
      >
        <BCWidgetCard
          title={t('org:orgDetails')}
          color="nav"
          editButton={
            canEdit
              ? {
                  text: t('org:editBtn'),
                  route: editButtonRoute,
                  id: 'edit-org-button'
                }
              : undefined
          }
          content={
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
                      {Math.abs(
                        orgBalanceInfo?.reservedBalance || 0
                      ).toLocaleString()}
                      )
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
                    {orgData?.orgStatus.status ===
                    ORGANIZATION_STATUSES.REGISTERED
                      ? t('org:registeredTransferYes')
                      : t('org:registeredTransferNo')}
                  </BCTypography>

                  {(hasRoles(roles.government) ||
                    orgData?.hasEarlyIssuance) && (
                    <BCTypography variant="body4">
                      <strong>
                        {t('org:earlyIssuanceIndicator', {
                          year: CURRENT_COMPLIANCE_YEAR
                        })}
                        :
                      </strong>{' '}
                      {orgData?.hasEarlyIssuance
                        ? t('common:yes')
                        : t('common:no')}
                    </BCTypography>
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
          }
        />
      </BCBox>
    </>
  )
}
