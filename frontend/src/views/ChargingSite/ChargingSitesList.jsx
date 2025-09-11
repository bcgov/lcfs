import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import { ROUTES } from '@/routes/routes'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

export const ChargingSitesList = ({ alertRef }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['report'])

  const handleNewSite = () => {
    navigate(`${ROUTES.REPORTS.LIST}/manage-charging-sites/new`)
  }

  // Check if we're on a nested route (like /new or /edit)
  const isOnNestedRoute =
    location.pathname !== `${ROUTES.REPORTS.LIST}/manage-charging-sites`

  return (
    <>
      {!isOnNestedRoute && (
        <>
          <BCTypography variant="h5" color="primary">
            {t('chargingSites.title')}
          </BCTypography>
          <BCTypography variant="body2" color="text.secondary" my={2}>
            {t('chargingSites.description')}
          </BCTypography>
          <BCButton
            id="new-site-button"
            variant="contained"
            size="small"
            color="primary"
            onClick={handleNewSite}
            sx={{ mb: 3 }}
          >
            <BCTypography variant="subtitle2">
              {t('chargingSites.newSiteBtn')}
            </BCTypography>
          </BCButton>
          {/* Add charging sites grid here */}
        </>
      )}
      <Outlet />
    </>
  )
}
