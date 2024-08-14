// react and npm library components
import { useEffect, useRef, useState, useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import BCButton from '@/components/BCButton'
import { Stack, Typography, List, ListItemButton, Fab, Tooltip } from '@mui/material'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
// styles
import colors from '@/themes/base/colors.js'
// hooks
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganization } from '@/hooks/useOrganization'
// internal components
import { constructAddress } from '@/utils/constructAddress'
import { ActivityLinksList } from './components/ActivityLinkList'
import { Introduction } from './components/Introduction'
import { useGetComplianceReport, useUpdateComplianceReport } from '@/hooks/useComplianceReports'
import ComplianceReportSummary from './components/ComplianceReportSummary'
import ReportDetails from './components/ReportDetails'
import { buttonClusterConfigFn } from './buttonConfigs'


const iconStyle = {
  width: '2rem', 
  height: '2rem',
  color: colors.white.main
}
export const EditViewComplianceReport = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const [modalData, setModalData] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const alertRef = useRef()

  const { compliancePeriod, complianceReportId } = useParams()
  const [isAtTop, setIsAtTop] = useState(true);

  const scrollToTopOrBottom = () => {
    if (isAtTop) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
      setIsAtTop(false);
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      setIsAtTop(true);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setIsAtTop(scrollTop === 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // hooks
  const { data: currentUser, isLoading: isCurrentUserLoading, hasRoles } = useCurrentUser()
  const isGovernmentUser = currentUser?.isGovernmentUser
  const {
    data: reportData,
    isLoading: isReportLoading,
    isError,
    error
  } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId
  )
  // TODO Temp Fix
  const currentStatus = 'test' // reportData?.data?.currentStatus?.status
  
  const { data: orgData, isLoading } = useOrganization(
    reportData?.data?.organizationId
  )
  const methods = useForm() // TODO we will need this for summary line inputs
  const { mutate: updateComplianceReport } = useUpdateComplianceReport(complianceReportId, {
    onSuccess: (response) => {
      setModalData(null)
    },
    onError: (error) => {
      setModalData(null)
      setAlertMessage(error.message)
      setAlertSeverity('error')
    }
  })

  const buttonClusterConfig = useMemo(
    () =>
      buttonClusterConfigFn({
        hasRoles,
        currentUser,
        methods,
        t,
        setModalData,
        updateComplianceReport,
        reportData,
        isGovernmentUser
      }),
    [hasRoles, currentUser, methods, t, setModalData, updateComplianceReport, reportData, isGovernmentUser]
  )

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
    if (isError) {
      setAlertMessage(error.message)
      setAlertSeverity('error')
    }
  }, [location.state, isError, error])

  if (isLoading || isReportLoading || isCurrentUserLoading) {
    return <Loading />
  }
  return (
    <>
      {alertMessage ? (
        <BCAlert
          ref={alertRef}
          data-test="alert-box"
          severity={alertSeverity}
          delay={65000}
        >
          {alertMessage}
        </BCAlert>
      ) : (
        <>
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
                <Typography variant="body3">
                  {t('report:bcAddrLabel')}:
                </Typography>{' '}
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
                    sx={{
                      display: 'list-item',
                      padding: '0',
                      marginLeft: '1rem'
                    }}
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
            {!location.state?.newReport && (
              <>
                <ReportDetails />
                <ComplianceReportSummary reportID={complianceReportId} />
              </>
            )}
            <Introduction expanded={location.state?.newReport} />
          </Stack>
          <Stack direction="row" justifyContent="flex-end" mt={2} gap={2}>
        {buttonClusterConfig[currentStatus]?.map((config) => (
          config && (
            <BCButton
              key={config.id}
              data-test={config.id}
              id={config.id}
              size="small"
              variant={config.variant}
              color={config.color}
              onClick={methods.handleSubmit(config.handler)}
              startIcon={
                config.startIcon && (
                  <FontAwesomeIcon
                    icon={config.startIcon}
                    className="small-icon"
                  />
                )
              }
              disabled={config.disabled}
            >
              {config.label}
            </BCButton>
          )
        ))}
      </Stack>
          <Tooltip
            title={
              isAtTop ? t('common:scrollToBottom') : t('common:scrollToTop')
            }
            placement="left"
            arrow
          >
            <Fab
              color="secondary"
              size="large"
              aria-label={isAtTop ? 'scroll to bottom' : 'scroll to top'}
              onClick={scrollToTopOrBottom}
              sx={{
                position: 'fixed',
                bottom: 75,
                right: 24
              }}
            >
              {isAtTop ? (
                <KeyboardArrowDownIcon sx={iconStyle} />
              ) : (
                <KeyboardArrowUpIcon sx={iconStyle} />
              )}
            </Fab>
          </Tooltip>
        </>
      )}
    </>
  )
}
