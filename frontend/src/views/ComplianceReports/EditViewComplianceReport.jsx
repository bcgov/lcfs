import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
// mui components
import { FloatingAlert } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCModal from '@/components/BCModal'
import BCButton from '@/components/BCButton'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
import { Fab, Stack, Tooltip, Typography } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
// styles
import colors from '@/themes/base/colors.js'
// constants
import { govRoles } from '@/constants/roles'
// hooks
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganization } from '@/hooks/useOrganization'
// internal components
import { Introduction } from './components/Introduction'
import {
  useGetComplianceReport,
  useUpdateComplianceReport
} from '@/hooks/useComplianceReports'
import ComplianceReportSummary from './components/ComplianceReportSummary'
import ReportDetails from './components/ReportDetails'
import { buttonClusterConfigFn } from './buttonConfigs'
import { ActivityListCard } from './components/ActivityListCard'
import { OrgDetailsCard } from './components/OrgDetailsCard'
import UploadCard from './components/UploadCard'
import { AssessmentCard } from './components/AssessmentCard'
import { ImportantInfoCard } from './components/ImportantInfoCard'
import InternalComments from '@/components/InternalComments'

const iconStyle = {
  width: '2rem',
  height: '2rem',
  color: colors.white.main
}
export const EditViewComplianceReport = () => {
  const { t } = useTranslation(['common', 'report'])
  const location = useLocation()
  const [modalData, setModalData] = useState(null)
  const [internalComment, setInternalComment] = useState('')
  const [hasMet, setHasMet] = useState(false)
  const [isSigningAuthorityDeclared, setIsSigningAuthorityDeclared] =
    useState(false)
  const alertRef = useRef()

  const { compliancePeriod, complianceReportId } = useParams()
  const [isScrollingUp, setIsScrollingUp] = useState(false)
  const [lastScrollTop, setLastScrollTop] = useState(0)

  const scrollToTopOrBottom = () => {
    if (isScrollingUp) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    } else {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      })
    }
  }
  const handleCommentChange = useCallback((newComment) => {
    setInternalComment(newComment)
  }, [])
  const handleScroll = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    setIsScrollingUp(scrollTop < lastScrollTop || scrollTop === 0)
    setLastScrollTop(scrollTop)
  }, [lastScrollTop])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // hooks
  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles
  } = useCurrentUser()
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
  const currentStatus = reportData?.data?.currentStatus?.status
  const { data: orgData, isLoading } = useOrganization(
    reportData?.data?.organizationId
  )
  const { mutate: updateComplianceReport } = useUpdateComplianceReport(
    complianceReportId,
    {
      onSuccess: (response) => {
        setModalData(null)
        alertRef.current?.triggerAlert({
          message: t('report:savedSuccessText'),
          severity: 'success'
        })
      },
      onError: (error) => {
        setModalData(null)
        alertRef.current?.triggerAlert({
          message: error.message,
          severity: 'error'
        })
      }
    }
  )

  const methods = useForm() // TODO we will need this for summary line inputs

  const buttonClusterConfig = useMemo(
    () =>
      buttonClusterConfigFn({
        hasRoles,
        currentUser,
        t,
        setModalData,
        updateComplianceReport,
        reportData,
        isGovernmentUser,
        isSigningAuthorityDeclared
      }),
    [
      hasRoles,
      currentUser,
      t,
      setModalData,
      updateComplianceReport,
      reportData,
      isGovernmentUser,
      isSigningAuthorityDeclared
    ]
  )

  useEffect(() => {
    if (location.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
    if (isError) {
      alertRef.current?.triggerAlert({
        message: error.response?.data?.detail || error.message,
        severity: 'error'
      })
    }
  }, [location.state, isError, error])

  if (isLoading || isReportLoading || isCurrentUserLoading) {
    return <Loading />
  }

  if (isError) {
    return (
      <>
        <FloatingAlert ref={alertRef} data-test="alert-box" delay={10000} />
        <Typography color="error">{t('report:errorRetrieving')}</Typography>
      </>
    )
  }

  return (
    <>
      <FloatingAlert ref={alertRef} data-test="alert-box" delay={10000} />
      <BCBox pl={2} pr={2}>
        <BCModal
          open={!!modalData}
          onClose={() => setModalData(null)}
          data={modalData}
        />
        <BCBox pb={2}>
          <Typography variant="h5" color="primary">
            {compliancePeriod + ' ' + t('report:complianceReport')} -{' '}
            {reportData?.data?.nickname}
          </Typography>
          <Typography
            variant="h6"
            color="primary"
            style={{ marginLeft: '0.25rem' }}
          >
            Status: {currentStatus}
          </Typography>
        </BCBox>
        <Stack direction="column" spacing={2} mt={2}>
          <Stack direction={{ md: 'column', lg: 'row' }} spacing={2} pb={2}>
            {currentStatus === 'Draft' ? (
              <>
                <ActivityListCard
                  name={orgData?.name}
                  period={compliancePeriod}
                />
                <UploadCard reportID={complianceReportId} />
              </>
            ) : (
              <>
                <AssessmentCard
                  orgName={orgData?.name}
                  history={reportData?.data?.history}
                  isGovernmentUser={isGovernmentUser}
                  hasMet={hasMet}
                />
                {!isGovernmentUser && (
                  <ImportantInfoCard
                    complianceReportId={complianceReportId}
                    alertRef={alertRef}
                  />
                )}
              </>
            )}
            <OrgDetailsCard
              orgName={orgData?.name}
              orgAddress={orgData?.orgAddress}
              orgAttorneyAddress={orgData?.orgAttorneyAddress}
              isGovernmentUser={isGovernmentUser}
            />
          </Stack>
          {!location.state?.newReport && (
            <>
              <ReportDetails currentStatus={currentStatus} />
              <ComplianceReportSummary
                reportID={complianceReportId}
                currentStatus={currentStatus}
                compliancePeriodYear={compliancePeriod}
                setIsSigningAuthorityDeclared={setIsSigningAuthorityDeclared}
                buttonClusterConfig={buttonClusterConfig}
                methods={methods}
                setHasMet={setHasMet}
                alertRef={alertRef}
              />
            </>
          )}
          {!isGovernmentUser && (
            <Introduction expanded={location.state?.newReport} />
          )}
          {/* Internal Comments */}
          {isGovernmentUser && (
            <BCBox mt={4}>
              <Typography variant="h6" color="primary">
                {t(`report:internalComments`)}
              </Typography>
              <BCBox>
                <Role roles={govRoles}>
                  <InternalComments
                    entityType={'complianceReport'}
                    entityId={parseInt(complianceReportId)}
                    onCommentChange={handleCommentChange}
                  />
                </Role>
              </BCBox>
              <Stack direction="row" justifyContent="flex-start" mt={2} gap={2}>
                {buttonClusterConfig[currentStatus]?.map(
                  (config) =>
                    config && (
                      <BCButton
                        key={config.id}
                        data-test={config.id}
                        id={config.id}
                        size="large"
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
                )}
              </Stack>
            </BCBox>
          )}
        </Stack>
        <Tooltip
          title={
            isScrollingUp ? t('common:scrollToTop') : t('common:scrollToBottom')
          }
          placement="left"
          arrow
        >
          <Fab
            color="secondary"
            size="large"
            aria-label={isScrollingUp ? 'scroll to top' : 'scroll to bottom'}
            onClick={scrollToTopOrBottom}
            sx={{
              position: 'fixed',
              bottom: 75,
              right: 24
            }}
          >
            {isScrollingUp ? (
              <KeyboardArrowUpIcon sx={iconStyle} />
            ) : (
              <KeyboardArrowDownIcon sx={iconStyle} />
            )}
          </Fab>
        </Tooltip>
      </BCBox>
    </>
  )
}
