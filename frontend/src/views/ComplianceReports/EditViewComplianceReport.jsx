// react and npm library components
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCModal from '@/components/BCModal'
import Loading from '@/components/Loading'
import BCButton from '@/components/BCButton'
import { Role } from '@/components/Role'
import { Stack, Typography, Fab, Tooltip } from '@mui/material'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
// styles
import colors from '@/themes/base/colors.js'
// constants
import { govRoles, roles } from '@/constants/roles'
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
import { timezoneFormatter } from '@/utils/formatters'
import SigningAuthorityDeclaration from './components/SigningAuthorityDeclaration'
import { ReportHistoryCard } from './components/ReportHistoryCard'
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
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [internalComment, setInternalComment] = useState('')
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
        setAlertMessage(t('report:savedSuccessText'))
        setAlertSeverity('success')
      },
      onError: (error) => {
        setModalData(null)
        setAlertMessage(error.message)
        setAlertSeverity('error')
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
      <BCBox pl={2} pr={2}>
        <BCModal
          open={!!modalData}
          onClose={() => setModalData(null)}
          data={modalData}
        />
        <BCBox pb={2}>
          <Typography variant="h5" color="primary">
            {compliancePeriod + ' ' + t('report:complianceReport')}
          </Typography>
        </BCBox>
        <Stack direction="column" spacing={2} mt={2}>
          <Stack direction={{ md: 'column', lg: 'row' }} spacing={2} pb={2}>
            {currentStatus === 'Assessed' && (
              <AssessmentCard
                orgName={orgData?.name}
                assessedDate={timezoneFormatter({
                  value: reportData?.data?.updateDate
                })}
              />
            )}
            {currentStatus === 'Draft' ? (
              <>
                <ActivityListCard
                  name={orgData?.name}
                  period={compliancePeriod}
                />
                <UploadCard />
              </>
            ) : (
              <>
                <ReportHistoryCard
                  history={reportData?.data?.history}
                  isGovernmentUser={isGovernmentUser}
                  currentStatus={currentStatus}
                />
                {!isGovernmentUser && <ImportantInfoCard />}
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
              />
            </>
          )}
          {!isGovernmentUser && <Introduction expanded={location.state?.newReport} />}
          {/* Internal Comments */}
          {isGovernmentUser &&
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
            </BCBox>}
        </Stack>
        {currentStatus === 'Draft' && (
          <SigningAuthorityDeclaration
            onChange={setIsSigningAuthorityDeclared}
          />
        )}
        <Stack direction="row" justifyContent="flex-end" mt={2} gap={2}>
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
        <Tooltip
          title={isScrollingUp ? t('common:scrollToTop') : t('common:scrollToBottom')}
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
