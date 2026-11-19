import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import AddIcon from '@mui/icons-material/Add'
import BCAlert, { FloatingAlert } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { lcjfipBceidRoles, lcjfipIdirRoles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useLCJFIPApplications } from '@/hooks/useLCJFIP'
import ROUTES from '@/routes/routes'
import withRole from '@/utils/withRole'

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-CA', {
        timeZone: 'America/Vancouver'
      })
    : ''

/** The applicant organization's applications and the way to start one. */
const ApplicantApplications = () => {
  const { t } = useTranslation(['lcjfip'])
  const navigate = useNavigate()
  const {
    data: applications = [],
    isLoading,
    isError
  } = useLCJFIPApplications()

  return (
    <section
      style={{ marginTop: 24 }}
      aria-labelledby="lcjfip-applications-heading"
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        mb={2}
      >
        <BCTypography
          id="lcjfip-applications-heading"
          variant="h6"
          component="h3"
          color="primary"
        >
          {t('lcjfip:landing.applicationsHeading')}
        </BCTypography>
        <BCButton
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate(ROUTES.LCJFIP.NEW_APPLICATION)}
          data-test="lcjfip-new-application"
        >
          {t('lcjfip:landing.newApplication')}
        </BCButton>
      </Stack>

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <BCAlert severity="error">{t('lcjfip:landing.loadError')}</BCAlert>
      ) : applications.length === 0 ? (
        <BCTypography variant="body2" data-test="lcjfip-no-applications">
          {t('lcjfip:landing.noApplications')}
        </BCTypography>
      ) : (
        <Paper variant="outlined">
          <Table size="small" data-test="lcjfip-applications">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  {t('lcjfip:landing.applicationColumn')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  {t('lcjfip:landing.statusColumn')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  {t('lcjfip:landing.submittedColumn')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  {t('lcjfip:landing.lastUpdatedColumn')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {applications.map((application) => (
                <TableRow key={application.lcjfipApplicationId}>
                  <TableCell>
                    <Link
                      component={RouterLink}
                      to={ROUTES.LCJFIP.APPLICATION.replace(
                        ':applicationId',
                        String(application.lcjfipApplicationId)
                      )}
                    >
                      {application.applicationNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{application.status}</TableCell>
                  <TableCell>{formatDate(application.signedDate)}</TableCell>
                  <TableCell>{formatDate(application.updateDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </section>
  )
}

// Landing page for the Low carbon jet fuel incentive program (#5488). BCeID
// applicants see their applications (#5532); the IDIR side is a later card.
export const LCJFIPBase = () => {
  const { t } = useTranslation(['common'])
  const location = useLocation()
  const alertRef = useRef<{
    triggerAlert: (payload: { severity: 'success'; message: string }) => void
  } | null>(null)
  const { data: currentUser } = useCurrentUser()
  const isGovernment = !!currentUser?.isGovernmentUser

  useEffect(() => {
    const state = location.state as { message?: string } | null
    if (state?.message) {
      alertRef.current?.triggerAlert({
        severity: 'success',
        message: state.message
      })
    }
  }, [location.state])

  return (
    <BCBox>
      <FloatingAlert ref={alertRef as never} />
      {/* The layout's visually hidden h1 carries the route title, so the
          visible page title is the next heading level down. */}
      <BCTypography
        variant="h5"
        component="h2"
        color="primary"
        data-test="lcjfip-title"
      >
        {t('lcjfipPageTitle')}
      </BCTypography>
      {!isGovernment && <ApplicantApplications />}
    </BCBox>
  )
}

// Users without a permitted role who open the URL directly are sent to the
// dashboard, the same access-denied behaviour as the other role-gated pages.
export const LCJFIP = withRole(
  LCJFIPBase,
  [...lcjfipBceidRoles, ...lcjfipIdirRoles],
  ROUTES.DASHBOARD
)
LCJFIP.displayName = 'LCJFIP'

export default LCJFIP
