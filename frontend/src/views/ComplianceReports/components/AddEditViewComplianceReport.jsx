// react and npm library components
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
// mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { Stack, Typography, List, ListItemButton } from '@mui/material'
// styles
import colors from '@/themes/base/colors.js'
// hooks
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganization } from '@/hooks/useOrganization'
// internal components
import { constructAddress } from '@/utils/constructAddress'
import { ActivityLinksList } from './ActivityLinkList'
import { Introduction } from './Introduction'

export const AddEditViewComplianceReport = ({ period }) => {
  const { t } = useTranslation()

  const [modalData, setModalData] = useState(null)
  const [introExpanded, setIntroExpanded] = useState(true)

  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const alertRef = useRef()

  const { compliancePeriod, reportID } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  // hooks
  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles
  } = useCurrentUser()
  const { data: orgData, isLoading } = useOrganization(
    currentUser.organization?.organizationId
  )

  const handleIntroExpansion = (panel) => (event, isExpanded) => {
    setIntroExpanded(!introExpanded)
  }

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  if (isLoading || isCurrentUserLoading) {
    return <Loading />
  }
  return (
    <>
      {alertMessage && (
        <BCAlert
          ref={alertRef}
          data-test="alert-box"
          severity={alertSeverity}
          delay={65000}
        >
          {alertMessage}
        </BCAlert>
      )}
      <BCModal
        open={!!modalData}
        onClose={() => setModalData(null)}
        data={modalData}
      />
      <BCBox>
        <Typography variant="h5" color="primary">
          {compliancePeriod + ' ' + t('report:complianceReport')}
        </Typography>
      </BCBox>
      <BCBox p={2} my={1} bgColor={colors.grey[200]}>
        <Stack direction="column" spacing={0}>
          <Typography variant="h6" color="primary">
            {orgData?.name}
          </Typography>
          <div>
            <Typography variant="body3">
              {t('report:serviceAddrLabel')}:
            </Typography>{' '}
            <Typography variant="body3">
              {constructAddress(orgData.orgAddress)}
            </Typography>
          </div>
          <div>
            <Typography variant="body3">{t('report:bcAddrLabel')}:</Typography>{' '}
            <Typography variant="body3">
              {constructAddress(orgData.orgAttorneyAddress)}
            </Typography>
          </div>
        </Stack>
      </BCBox>
      <Stack direction="column" spacing={2} mt={2}>
        <Typography variant="body4" color="text" component="div">
          {t('report:activityHdrLabel', {
            name: orgData?.name,
            period: compliancePeriod
          })}
        </Typography>
        <Typography variant="body4" color="text" component="div">
          {t('report:activityLinksList')}:
        </Typography>
        <Stack
          direction={{ md: 'column', lg: 'row' }}
          spacing={32}
          sx={{ '.upload-box': { marginTop: { xs: '2%', md: '0' } } }}
        >
          <ActivityLinksList />
          <BCBox
            className="upload-box"
            p={2}
            bgColor={colors.grey[200]}
            sx={{ width: { xs: '100%', md: '45%' }, height: '80%' }}
          >
            <List
              component="div"
              sx={{ maxWidth: '100%', listStyleType: 'disc' }}
            >
              {' '}
              <ListItemButton
                sx={{ display: 'list-item', padding: '0', marginLeft: '1rem' }}
                component="a"
                alignItems="flex-start"
                onClick={() => console.log('handle upload functionality')}
              >
                <BCTypography
                  variant="subtitle2"
                  color="link"
                  sx={{
                    textDecoration: 'underline',
                    fontWeight: '500',
                    '&:hover': { color: 'info.main' }
                  }}
                >
                  {t('report:uploadLabel')}
                </BCTypography>
              </ListItemButton>
            </List>
          </BCBox>
        </Stack>
        {/* controlled accordian */}
        <Introduction
          expanded={introExpanded}
          handleChange={handleIntroExpansion}
        />
      </Stack>
    </>
  )
}
