import { FloatingAlert } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import InternalComments from '@/components/InternalComments'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
import { govRoles, roles } from '@/constants/roles'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import {
  useDeleteComplianceReport,
  useUpdateComplianceReport
} from '@/hooks/useComplianceReports'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ComplianceReportSummary from './components/ComplianceReportSummary'
import ReportDetails from './components/ReportDetails'

import { buttonClusterConfigFn } from './buttonConfigs'
import { ActivityListCard } from './components/ActivityListCard'
import { AssessmentCard } from './components/AssessmentCard'
import { AssessmentRecommendation } from '@/views/ComplianceReports/components/AssessmentRecommendation.jsx'
import { AssessmentStatement } from '@/views/ComplianceReports/components/AssessmentStatement.jsx'
import { useOrganization } from '@/hooks/useOrganization.js'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser.js'
import { Fab, Stack, Tooltip } from '@mui/material'
import { Introduction } from '@/views/ComplianceReports/components/Introduction.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import colors from '@/themes/base/colors.js'
import ROUTES from '@/routes/routes.js'
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material'
import { FILTER_KEYS, REPORT_SCHEDULES } from '@/constants/common.js'

const iconStyle = {
  width: '2rem',
  height: '2rem',
  color: colors.white.main
}
export const EditViewComplianceReport = ({ reportData, isError, error }) => {
  const { t } = useTranslation(['common', 'report'])
  const location = useLocation()
  const [modalData, setModalData] = useState(null)

  const [isSigningAuthorityDeclared, setIsSigningAuthorityDeclared] =
    useState(false)
  const alertRef = useRef()
  const navigate = useNavigate()

  const { compliancePeriod, complianceReportId } = useParams()
  const [isScrollingUp, setIsScrollingUp] = useState(false)
  const [lastScrollTop, setLastScrollTop] = useState(0)

  const isQuarterlyReport = useMemo(() => {
    return reportData?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY
  }, [reportData?.report?.reportingFrequency])

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
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const scrollPosition = window.scrollY + window.innerHeight
    const documentHeight = document.documentElement.scrollHeight
    if (scrollTop === 0) {
      setIsScrollingUp(false)
    } else if (scrollPosition >= documentHeight - 10) {
      setIsScrollingUp(true)
    } else {
      setIsScrollingUp(scrollTop < lastScrollTop || scrollTop === 0)
    }
    setLastScrollTop(scrollTop)
  }, [lastScrollTop])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles,
    hasAnyRole
  } = useCurrentUser()
  const isGovernmentUser = currentUser?.isGovernmentUser
  const currentStatus = reportData?.report.currentStatus?.status
  const canEdit =
    (currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT &&
      hasAnyRole(roles.compliance_reporting, roles.signing_authority)) ||
    (currentStatus === COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT &&
      hasRoles(roles.analyst))

  const { data: orgData, isLoading } = useOrganization(
    reportData?.report.organizationId
  )

  const { mutate: updateComplianceReport } = useUpdateComplianceReport(
    complianceReportId,
    {
      onSuccess: (response) => {
        setModalData(null)
        const updatedStatus = JSON.parse(response.config.data)?.status

        // Clear Filters before navigating to ensure they can see the report
        sessionStorage.setItem(FILTER_KEYS.COMPLIANCE_REPORT_GRID, '{}')

        navigate(ROUTES.REPORTS.LIST, {
          state: {
            message: t('report:savedSuccessText', {
              status: updatedStatus.toLowerCase().replace('return', 'returned')
            }),
            severity: 'success'
          }
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

  const { mutate: deleteComplianceReport } = useDeleteComplianceReport(
    reportData?.report.organizationId,
    complianceReportId,
    {
      onSuccess: () => {
        setModalData(null)
        navigate(ROUTES.REPORTS.LIST, {
          state: {
            message: t('report:reportDeleteSuccessText'),
            severity: 'success'
          }
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
        deleteComplianceReport,
        compliancePeriod,
        isGovernmentUser,
        isSigningAuthorityDeclared,
        supplementalInitiator: reportData?.report?.supplementalInitiator
      }),
    [
      hasRoles,
      currentUser,
      t,
      setModalData,
      updateComplianceReport,
      deleteComplianceReport,
      compliancePeriod,
      isGovernmentUser,
      isSigningAuthorityDeclared,
      reportData?.report
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

  if (isLoading || isCurrentUserLoading) {
    return <Loading />
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
            {isQuarterlyReport
              ? `${compliancePeriod} ${t('report:complianceReportEarlyIssuance')} ${reportData?.report?.quarter ?? [1]}`
              : `${compliancePeriod} ${t('report:complianceReport')} - ${reportData?.report.nickname}`}
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
          <Stack direction={{ md: 'column', lg: 'row' }} spacing={2} pb={2}>
            {canEdit && (
              <ActivityListCard
                name={orgData?.name}
                period={compliancePeriod}
                isQuarterlyReport={isQuarterlyReport}
                quarter={reportData?.report?.quarter ?? [1]}
                reportID={complianceReportId}
                currentStatus={currentStatus}
              />
            )}
            <AssessmentCard
              reportData={reportData}
              orgData={orgData}
              isGovernmentUser={isGovernmentUser}
              currentStatus={currentStatus}
              complianceReportId={complianceReportId}
              alertRef={alertRef}
              hasSupplemental={reportData?.report.hasSupplemental}
              chain={reportData.chain}
              isQuarterlyReport={isQuarterlyReport}
            />
          </Stack>
          {!location.state?.newReport && (
            <>
              <ReportDetails
                canEdit={canEdit}
                currentStatus={currentStatus}
                userRoles={currentUser?.userRoles}
              />
              <ComplianceReportSummary
                enableCompareMode={reportData.chain.length > 1}
                canEdit={canEdit}
                reportID={complianceReportId}
                currentStatus={currentStatus}
                compliancePeriodYear={compliancePeriod}
                setIsSigningAuthorityDeclared={setIsSigningAuthorityDeclared}
                buttonClusterConfig={buttonClusterConfig}
                methods={methods}
                alertRef={alertRef}
              />
            </>
          )}
          {!isGovernmentUser && (
            <Introduction
              expanded={location.state?.newReport}
              compliancePeriod={compliancePeriod}
            />
          )}
          {isGovernmentUser && !isQuarterlyReport && <AssessmentStatement />}
          {hasRoles(roles.analyst) && !isQuarterlyReport && (
            <AssessmentRecommendation
              reportData={reportData}
              complianceReportId={complianceReportId}
              currentStatus={currentStatus}
            />
          )}
          {/* Internal Comments */}
          {isGovernmentUser && (
            <BCBox mt={4}>
              <BCTypography variant="h6" color="primary">
                {t(`report:internalComments`)}
              </BCTypography>
              <BCBox>
                <Role roles={govRoles}>
                  <InternalComments
                    entityType="complianceReport"
                    entityId={parseInt(complianceReportId)}
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
                        size="small"
                        variant={config.variant}
                        color={config.color}
                        onClick={methods.handleSubmit(() =>
                          config.handler({
                            assessmentStatement:
                              reportData?.report.assessmentStatement
                          })
                        )}
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
