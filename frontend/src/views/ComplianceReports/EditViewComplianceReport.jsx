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
  useUpdateComplianceReport,
  useCreateSupplementalReport,
  useCreateAnalystAdjustment,
  useCreateIdirSupplementalReport,
  useGetComplianceReport
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
import { Fab, Stack, Tooltip, Alert, AlertTitle } from '@mui/material'
import { Introduction } from '@/views/ComplianceReports/components/Introduction.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import colors from '@/themes/base/colors.js'
import ROUTES from '@/routes/routes.js'
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material'
import { FILTER_KEYS, REPORT_SCHEDULES } from '@/constants/common.js'
import { isQuarterEditable } from '@/utils/grid/cellEditables.jsx'
import ComplianceReportEarlyIssuanceSummary from '@/views/ComplianceReports/components/ComplianceReportEarlyIssuanceSummary.jsx'
import { DateTime } from 'luxon'

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

  // Store if we've already shown an alert for this location state to prevent duplicates
  const [hasProcessedLocationAlert, setHasProcessedLocationAlert] =
    useState(false)

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

  const qReport = useMemo(() => {
    const isQuarterly =
      reportData?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY
    let quarter = null

    if (isQuarterly) {
      const isDraft = currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT
      const now = new Date()
      const submittedHistory = reportData?.report?.history.find(
        (h) => h.status.status === COMPLIANCE_REPORT_STATUSES.SUBMITTED
      )
      const createDateFromHistory = submittedHistory?.createDate
      const updateDate = reportData?.report?.updateDate

      const submittedDate = createDateFromHistory
        ? new Date(createDateFromHistory)
        : updateDate
          ? new Date(updateDate)
          : now

      // Get month (0-11) and calculate quarter
      const month = submittedDate.getMonth()
      const submittedYear = submittedDate.getFullYear()
      const currentYear = now.getFullYear()
      if (
        (isDraft && currentYear > parseInt(compliancePeriod)) ||
        submittedYear > parseInt(compliancePeriod)
      ) {
        quarter = 4
      } else if (month >= 0 && month <= 2) {
        quarter = 1 // Jan-Mar: Q1
      } else if (month >= 3 && month <= 5) {
        quarter = 2 // Apr-Jun: Q2
      } else if (month >= 6 && month <= 8) {
        quarter = 3 // Jul-Sep: Q3
      } else {
        quarter = 4 // Oct-Dec: Q4
      }
    }

    return {
      quarter,
      isQuarterly
    }
  }, [
    reportData?.report?.reportingFrequency,
    reportData?.report?.history,
    reportData?.report?.updateDate,
    currentStatus,
    compliancePeriod
  ])

  const {
    data: complianceReportData,
    isLoading: isLoadingReport,
    isError: isErrorReport
  } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId,
    { enabled: !!complianceReportId }
  )

  // Derive hasDraftSupplemental state
  const [hasDraftSupplemental, setHasDraftSupplemental] = useState(false)
  useEffect(() => {
    if (complianceReportData) {
      // Simply use the isNewest flag from the backend
      // If isNewest is false, there's a newer version (which would be a draft)
      setHasDraftSupplemental(!complianceReportData.isNewest)
    } else {
      setHasDraftSupplemental(false)
    }
  }, [complianceReportData])

  // Determine if the current report is a draft supplemental for the 30-day notice
  const isDraftSupplemental =
    complianceReportData?.report?.currentStatus.status ===
      COMPLIANCE_REPORT_STATUSES.DRAFT &&
    complianceReportData?.report?.version > 0
  let submissionDeadline = null
  let daysRemaining = null
  if (isDraftSupplemental && complianceReportData?.report?.createTimestamp) {
    const creationDate = DateTime.fromISO(
      complianceReportData.report.createTimestamp
    )
    submissionDeadline = creationDate.plus({ days: 30 })
    daysRemaining = Math.ceil(submissionDeadline.diffNow('days').days)
  }

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
    currentUser?.organization?.organizationId,
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

  const { mutate: createSupplementalReport } = useCreateSupplementalReport(
    complianceReportId,
    {
      onSuccess: (res) => {
        setModalData(null)
        navigate(
          `${ROUTES.REPORTS.LIST}/${res.data.compliancePeriod.description}/${res.data.complianceReportId}`
        )
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

  const { mutate: createAnalystAdjustment } = useCreateAnalystAdjustment(
    complianceReportId,
    {
      onSuccess: (res) => {
        setModalData(null)
        navigate(
          `${ROUTES.REPORTS.LIST}/${res.data.compliancePeriod.description}/${res.data.complianceReportId}`
        )
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

  const { mutate: createIdirSupplementalReport } =
    useCreateIdirSupplementalReport(complianceReportId, {
      onSuccess: (res) => {
        setModalData(null)
        // Clear Filters before navigating to ensure they can see the report
        sessionStorage.setItem(FILTER_KEYS.COMPLIANCE_REPORT_GRID, '{}')
        navigate(ROUTES.REPORTS.LIST, {
          state: {
            message: t(
              'report:supplementalCreatedSuccessText',
              'Supplemental report created successfully.'
            ),
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
    })

  const methods = useForm() // TODO we will need this for summary line inputs
  const isSupplemental = reportData?.report?.hasSupplemental
  const buttonClusterConfig = useMemo(
    () =>
      buttonClusterConfigFn({
        hasRoles,
        currentUser,
        t,
        setModalData,
        updateComplianceReport,
        deleteComplianceReport,
        createSupplementalReport,
        createAnalystAdjustment,
        createIdirSupplementalReport,
        compliancePeriod,
        isGovernmentUser,
        isSigningAuthorityDeclared,
        hasDraftSupplemental,
        reportVersion: reportData?.report?.version,
        isSupplemental
      }),
    [
      hasRoles,
      currentUser,
      t,
      setModalData,
      updateComplianceReport,
      deleteComplianceReport,
      createSupplementalReport,
      createAnalystAdjustment,
      createIdirSupplementalReport,
      compliancePeriod,
      isGovernmentUser,
      isSigningAuthorityDeclared,
      hasDraftSupplemental,
      reportData?.report?.version,
      isSupplemental
    ]
  )

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

    if (isError) {
      alertRef.current?.triggerAlert({
        message: error.response?.data?.detail || error.message,
        severity: 'error'
      })
    }
  }, [
    location.state,
    isError,
    error,
    navigate,
    hasProcessedLocationAlert,
    location.pathname
  ])

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

  const isEarlyIssuance =
    reportData.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY
  const showEarlyIssuanceSummary =
    isEarlyIssuance && !isQuarterEditable(4, compliancePeriod)

  const report = complianceReportData?.report
  const isReadOnly = isGovernmentUser && hasDraftSupplemental

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
            {qReport?.isQuarterly
              ? `${compliancePeriod} ${t('report:complianceReportEarlyIssuance')} ${qReport?.quarter}`
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
                isQuarterlyReport={qReport?.isQuarterly}
                quarter={qReport?.quarter}
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
              isQuarterlyReport={qReport?.isQuarterly}
            />
          </Stack>
          {!location.state?.newReport && (
            <>
              <ReportDetails
                canEdit={canEdit}
                currentStatus={currentStatus}
                userRoles={currentUser?.userRoles}
              />
              {!showEarlyIssuanceSummary && (
                <ComplianceReportSummary
                  reportID={complianceReportId}
                  enableCompareMode={reportData.chain.length > 1}
                  canEdit={canEdit}
                  currentStatus={currentStatus}
                  compliancePeriodYear={compliancePeriod}
                  setIsSigningAuthorityDeclared={setIsSigningAuthorityDeclared}
                  buttonClusterConfig={buttonClusterConfig}
                  methods={methods}
                  alertRef={alertRef}
                />
              )}
              {showEarlyIssuanceSummary && (
                <ComplianceReportEarlyIssuanceSummary reportData={reportData} />
              )}
            </>
          )}
          {!isGovernmentUser && (
            <Introduction
              expanded={location.state?.newReport}
              compliancePeriod={compliancePeriod}
              isEarlyIssuance={showEarlyIssuanceSummary}
            />
          )}

          <BCTypography
            color="primary"
            variant="h5"
            mb={2}
            mt={2}
            component="div"
          >
            {t('report:assessmentRecommendation')}
          </BCTypography>

          <BCBox
            sx={{
              border: '1px solid rgba(0, 0, 0, 0.28)',
              padding: '20px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.28)'
            }}
          >
            {isGovernmentUser && !qReport?.isQuarterly && (
              <AssessmentStatement />
            )}
            {hasRoles(roles.analyst) && !qReport?.isQuarterly && (
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
                <Stack
                  direction="row"
                  justifyContent="flex-start"
                  mt={2}
                  gap={2}
                >
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
          </BCBox>

          {/* 30-Day Submission Notice for BCeID on Draft Supplementals */}
          {!isGovernmentUser && isDraftSupplemental && submissionDeadline && (
            <Alert
              severity={daysRemaining < 0 ? 'error' : 'info'}
              sx={{ mb: 2 }}
            >
              <AlertTitle>
                {daysRemaining < 0
                  ? 'Submission Period Overdue'
                  : 'Supplemental Report Submission'}
              </AlertTitle>
              {daysRemaining >= 0
                ? `Please submit this supplemental report by ${submissionDeadline.toLocaleString(DateTime.DATE_FULL)} (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining).`
                : 'The suggested 30-day submission period for this supplemental report has passed.'}
            </Alert>
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
