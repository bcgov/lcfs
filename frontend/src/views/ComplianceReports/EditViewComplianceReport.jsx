// react and npm library components
import { useEffect, useRef, useState, useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCModal from '@/components/BCModal'
import Loading from '@/components/Loading'
import BCButton from '@/components/BCButton'
import { Stack, Typography, Fab, Tooltip } from '@mui/material'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
// styles
import colors from '@/themes/base/colors.js'
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
  const [isSigningAuthorityDeclared, setIsSigningAuthorityDeclared] =
    useState(false)
  const alertRef = useRef()

  const { compliancePeriod, complianceReportId } = useParams()
  const [isAtTop, setIsAtTop] = useState(true)

  const scrollToTopOrBottom = () => {
    if (isAtTop) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      })
      setIsAtTop(false)
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
      setIsAtTop(true)
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      setIsAtTop(scrollTop === 0)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
              <ImportantInfoCard />
            )}
            <OrgDetailsCard
              orgName={orgData?.name}
              orgAddress={orgData?.orgAddress}
              orgAttorneyAddress={orgData?.orgAttorneyAddress}
            />
          </Stack>
          {!location.state?.newReport && (
            <>
              <ReportDetails currentStatus={currentStatus} />
              <ComplianceReportSummary reportID={complianceReportId} />
            </>
          )}
          <Introduction expanded={location.state?.newReport} />
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
          title={isAtTop ? t('common:scrollToBottom') : t('common:scrollToTop')}
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
      </BCBox>
    </>
  )
}
