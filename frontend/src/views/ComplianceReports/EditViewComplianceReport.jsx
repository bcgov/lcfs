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
  useCreateIdirSupplementalReport
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
import useComplianceReportStore from '@/stores/useComplianceReportStore'
import { useQueryClient } from '@tanstack/react-query'

const iconStyle = {
  width: '2rem',
  height: '2rem',
  color: colors.white.main
}

export const EditViewComplianceReport = ({ isError, error }) => {
  const { t } = useTranslation(['common', 'report'])
  const location = useLocation()
  const [modalData, setModalData] = useState(null)
  const [isDeleted, setIsDeleted] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [isSigningAuthorityDeclared, setIsSigningAuthorityDeclared] =
    useState(false)
  const alertRef = useRef()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Store if we've already shown an alert for this location state to prevent duplicates
  const [hasProcessedLocationAlert, setHasProcessedLocationAlert] =
    useState(false)

  const { compliancePeriod, complianceReportId } = useParams()

  // Get report data from store
  const reportData = useComplianceReportStore((state) =>
    state.getCachedReport(complianceReportId)
  )

  const [isScrollingUp, setIsScrollingUp] = useState(false)
  const [lastScrollTop, setLastScrollTop] = useState(0)

  // Early return if report is deleted or being deleted
  if (isDeleted || isDeleting) {
    return <Loading />
  }

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

  // Get current user data - with conditional fetching
  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles,
    hasAnyRole
  } = useCurrentUser()

  const isGovernmentUser = currentUser?.isGovernmentUser
  const currentStatus = reportData?.report?.currentStatus?.status
  const canEdit =
    (currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT &&
      hasAnyRole(roles.compliance_reporting, roles.signing_authority)) ||
    (currentStatus === COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT &&
      hasRoles(roles.analyst))

  const { data: orgData, isLoading } = useOrganization(
    reportData?.report?.organizationId,
    {
      enabled: !isDeleted && !isDeleting && !!reportData?.report?.organizationId
    }
  )

  const qReport = useMemo(() => {
    // Don't calculate if report is being deleted
    if (isDeleted || isDeleting || !reportData) {
      return { quarter: null, isQuarterly: false }
    }

    const isQuarterly =
      reportData?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY
    let quarter = null

    if (isQuarterly) {
      const isDraft = currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT
      const now = new Date()
      const submittedHistory = reportData?.report?.history?.find(
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
    compliancePeriod,
    isDeleted,
    isDeleting
  ])

  // Derive hasDraftSupplemental state
  const [hasDraftSupplemental, setHasDraftSupplemental] = useState(false)
  useEffect(() => {
    if (reportData && !isDeleted && !isDeleting) {
      // Simply use the isNewest flag from the backend
      // If isNewest is false, there's a newer version (which would be a draft)
      setHasDraftSupplemental(!reportData.isNewest)
    } else {
      setHasDraftSupplemental(false)
    }
  }, [reportData, isDeleted, isDeleting])

  // Determine if the current report is a draft supplemental for the 30-day notice
  const isDraftSupplemental =
    reportData?.report?.currentStatus?.status ===
      COMPLIANCE_REPORT_STATUSES.DRAFT && reportData?.report?.version > 0

  let submissionDeadline = null
  let daysRemaining = null
  if (
    isDraftSupplemental &&
    reportData?.report?.createTimestamp &&
    !isDeleted &&
    !isDeleting
  ) {
    const creationDate = DateTime.fromISO(reportData.report.createTimestamp)
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
      onMutate: () => {
        setIsDeleting(true)
        setIsDeleted(true)
      },
      onSuccess: () => {
        setModalData(null)

        // Clean up React Query cache
        queryClient.removeQueries({
          queryKey: ['complianceReport', complianceReportId]
        })
        queryClient.removeQueries({
          queryKey: ['organization', reportData?.report?.organizationId]
        })

        // Navigate to list page
        navigate(ROUTES.REPORTS.LIST, {
          state: {
            message: t('report:reportDeleteSuccessText'),
            severity: 'success'
          },
          replace: true
        })
      },
      onError: (error) => {
        // Reset states on error
        setIsDeleting(false)
        setIsDeleted(false)
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

  const methods = useForm()

  // Memoized report context conditions
  const reportConditions = useMemo(() => {
    if (isDeleted || isDeleting || !reportData) {
      return {
        isSupplemental: false,
        isEarlyIssuance: false,
        showEarlyIssuanceSummary: false
      }
    }

    const isSupplemental = reportData?.report?.hasSupplemental
    const isEarlyIssuance =
      reportData?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY
    // TODO: Currently showing full summary instead of early issuance summary
    // Original logic: const showEarlyIssuanceSummary = isEarlyIssuance && !isQuarterEditable(4, compliancePeriod)
    const showEarlyIssuanceSummary = false // Always show full summary for now

    return {
      isSupplemental,
      isEarlyIssuance,
      showEarlyIssuanceSummary
    }
  }, [
    reportData?.report?.hasSupplemental,
    reportData?.report?.reportingFrequency,
    isDeleted,
    isDeleting
  ])

  // Memoized assessment section visibility - with deletion checks
  const assessmentSectionConfig = useMemo(() => {
    if (isDeleted || isDeleting) {
      return {
        shouldShowAssessmentStatement: false,
        shouldShowAssessmentRecommendation: false,
        shouldShowAssessmentSectionTitle: false
      }
    }

    const shouldShowAssessmentStatement =
      isGovernmentUser && !qReport?.isQuarterly && !hasDraftSupplemental

    const shouldShowAssessmentRecommendation =
      hasRoles(roles.analyst) && !qReport?.isQuarterly && !hasDraftSupplemental

    const shouldShowAssessmentSectionTitle =
      shouldShowAssessmentStatement || shouldShowAssessmentRecommendation

    return {
      shouldShowAssessmentStatement,
      shouldShowAssessmentRecommendation,
      shouldShowAssessmentSectionTitle
    }
  }, [
    isGovernmentUser,
    qReport?.isQuarterly,
    hasDraftSupplemental,
    hasRoles,
    isDeleted,
    isDeleting
  ])

  const { isSupplemental, isEarlyIssuance, showEarlyIssuanceSummary } =
    reportConditions
  const {
    shouldShowAssessmentStatement,
    shouldShowAssessmentRecommendation,
    shouldShowAssessmentSectionTitle
  } = assessmentSectionConfig

  const buttonClusterConfig = useMemo(() => {
    // Don't create button config if report is being deleted
    if (isDeleted || isDeleting || !reportData) {
      return {}
    }

    const context = {
      // Required fields
      currentStatus,
      hasRoles,
      hasAnyRole,
      t,
      setModalData,

      // Report metadata
      reportVersion: reportData?.report?.version,
      compliancePeriod,
      isSigningAuthorityDeclared,

      // Report type flags
      isEarlyIssuance,
      isOriginalReport: reportData?.report?.version === 0,
      isAnalystAdjustment:
        currentStatus === COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT,

      // Conflict detection
      hasDraftSupplemental,

      // Business rules
      hadBeenAssessed: reportData?.hadBeenAssessed,

      // Action functions
      updateComplianceReport,
      deleteComplianceReport,
      createSupplementalReport,
      createIdirSupplementalReport,
      createAnalystAdjustment,
      amendPenalties: () => {}
    }
    return buttonClusterConfigFn(context)
  }, [
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
    isSupplemental,
    isDeleted,
    isDeleting,
    currentStatus,
    isEarlyIssuance
  ])

  useEffect(() => {
    // Don't process alerts if report is being deleted
    if (isDeleted || isDeleting) return

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
    location.pathname,
    isDeleted,
    isDeleting
  ])

  // Don't render main content if report is being deleted
  if (isLoading || isCurrentUserLoading || isDeleted || isDeleting) {
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
            {qReport?.isQuarterly
              ? `${compliancePeriod} ${t('report:complianceReportEarlyIssuance')} ${qReport?.quarter}`
              : `${compliancePeriod} ${t('report:complianceReport')} - ${reportData?.report?.nickname}`}
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
              hasSupplemental={reportData?.report?.hasSupplemental}
              chain={reportData?.chain}
            />
          </Stack>
          {!location.state?.newReport && (
            <>
              <ReportDetails
                canEdit={canEdit}
                currentStatus={currentStatus}
                hasRoles={hasRoles}
                complianceReportData={reportData}
              />
              {!showEarlyIssuanceSummary && (
                <ComplianceReportSummary
                  reportID={complianceReportId}
                  enableCompareMode={reportData?.chain?.length > 1}
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
              isEarlyIssuance={isEarlyIssuance}
            />
          )}
          {shouldShowAssessmentSectionTitle && (
            <BCTypography
              color="primary"
              variant="h5"
              mb={2}
              mt={2}
              component="div"
            >
              {t('report:assessmentRecommendation')}
            </BCTypography>
          )}
          {(shouldShowAssessmentSectionTitle || isGovernmentUser) && (
            <BCBox
              sx={{
                border: '1px solid rgba(0, 0, 0, 0.28)',
                padding: '20px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.28)'
              }}
            >
              {shouldShowAssessmentStatement && <AssessmentStatement />}
              {shouldShowAssessmentRecommendation && (
                <AssessmentRecommendation
                  reportData={reportData}
                  complianceReportId={complianceReportId}
                  currentStatus={currentStatus}
                />
              )}
              {/* Internal Comments */}
              {isGovernmentUser && (
                <BCBox mt={2}>
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
                </BCBox>
              )}
            </BCBox>
          )}
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
          {/* Action Buttons */}
          {buttonClusterConfig[currentStatus]?.length > 0 &&
            buttonClusterConfig[currentStatus]?.some((config) => config) &&
            currentStatus !== COMPLIANCE_REPORT_STATUSES.DRAFT && (
              <Stack
                direction="row"
                justifyContent="flex-start"
                mt={3}
                mb={2}
                gap={2}
              >
                {buttonClusterConfig[currentStatus]?.map(
                  (config) =>
                    config && (
                      <BCButton
                        key={config.id}
                        id={config.id}
                        data-test={config.id}
                        size="small"
                        variant={config.variant}
                        color={config.color}
                        onClick={methods.handleSubmit(config.handler)}
                        disabled={config.disabled}
                        startIcon={
                          config.startIcon && (
                            <FontAwesomeIcon
                              icon={config.startIcon}
                              className="small-icon"
                            />
                          )
                        }
                      >
                        {config.label}
                      </BCButton>
                    )
                )}
              </Stack>
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
