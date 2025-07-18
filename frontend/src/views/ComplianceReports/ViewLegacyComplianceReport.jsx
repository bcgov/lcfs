import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FloatingAlert } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCModal from '@/components/BCModal'
import Loading from '@/components/Loading'
import { Fab, Stack, Tooltip } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import colors from '@/themes/base/colors.js'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganization } from '@/hooks/useOrganization'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config.js'
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material'
import { AssessmentCard } from '@/views/ComplianceReports/components/AssessmentCard.jsx'

const iconStyle = {
  width: '2rem',
  height: '2rem',
  color: colors.white.main
}
export const ViewLegacyComplianceReport = ({ reportData, error, isError }) => {
  const { t } = useTranslation(['common', 'report'])
  const [modalData, setModalData] = useState(null)
  const alertRef = useRef()
  const location = useLocation()
  const navigate = useNavigate()
  const [hasProcessedLocationAlert, setHasProcessedLocationAlert] =
    useState(false)

  const [isScrollingUp, setIsScrollingUp] = useState(false)
  const [lastScrollTop, setLastScrollTop] = useState(0)
  const [isSigningAuthorityDeclared, setIsSigningAuthorityDeclared] =
    useState(false)

  const { compliancePeriod, complianceReportId } = useParams()
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

  const handleScroll = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    setIsScrollingUp(scrollTop < lastScrollTop || scrollTop === 0)
    setLastScrollTop(scrollTop)
  }, [lastScrollTop])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const { data: currentUser, isLoading: isCurrentUserLoading } =
    useCurrentUser()
  const isGovernmentUser = currentUser?.isGovernmentUser

  const currentStatus = reportData.report.currentStatus?.status
  const { data: orgData, isLoading } = useOrganization(
    reportData.report.organizationId
  )

  // Add effect to handle location alerts in one place
  useEffect(() => {
    // Only handle location state alerts if we haven't processed them yet
    if (location.state?.message && !hasProcessedLocationAlert) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
      // Mark that we've processed this alert
      setHasProcessedLocationAlert(true)

      // Clear the message from location state to prevent child components from showing it
      navigate(location.pathname, {
        replace: true,
        state: { ...location.state, message: undefined, severity: undefined }
      })
    }
  }, [location.state, navigate, hasProcessedLocationAlert, location.pathname])

  if (isLoading || isCurrentUserLoading) {
    return <Loading />
  }

  const dummyButtonClusterConfig = {}
  const dummyMethods = {
    handleSubmit: () => () => {}
  }

  if (isError) {
    return (
      <>
        <FloatingAlert ref={alertRef} data-test="alert-box" delay={10000} />
        <BCTypography color="error">{t('report:errorRetrieving')}</BCTypography>
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
          <BCTypography
            data-test="compliance-report-header"
            variant="h5"
            color="primary"
          >
            {reportData?.report.compliancePeriod.description}&nbsp;
            {t('report:complianceReport')}&#32;-&#32;
            {reportData?.report.nickname}
          </BCTypography>
          <BCTypography
            variant="h6"
            color="primary"
            style={{ marginLeft: '0.25rem' }}
            data-test="compliance-report-status"
          >
            Status: {currentStatus}
          </BCTypography>
        </BCBox>
        <Stack direction="column" mt={2}>
          <AssessmentCard
            report={reportData.report}
            orgData={orgData}
            isGovernmentUser={isGovernmentUser}
            chain={reportData.chain}
            complianceReportId={complianceReportId}
            compliancePeriod={compliancePeriod}
          />
        </Stack>

        <BCTypography variant="h6" color="primary" sx={{ marginY: '16px' }}>
          {t('report:questions')}
        </BCTypography>
        <BCTypography
          variant="body4"
          sx={{
            '& p': {
              marginBottom: '16px'
            },
            '& p:last-child': {
              marginBottom: '0'
            }
          }}
          dangerouslySetInnerHTML={{ __html: t('report:contact') }}
        ></BCTypography>
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
              <KeyboardArrowUp sx={iconStyle} />
            ) : (
              <KeyboardArrowDown sx={iconStyle} />
            )}
          </Fab>
        </Tooltip>
      </BCBox>
    </>
  )
}
