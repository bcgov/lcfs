import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useCallback, useRef, useState } from 'react'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ChargingSiteProfile } from './ChargingSiteProfile'
import BCBox from '@/components/BCBox'
import { roles } from '@/constants/roles'
import Loading from '@/components/Loading'
import ROUTES from '@/routes/routes'

export const ChargingSiteCard = ({ addMode = false }) => {
  const alertRef = useRef(null)
  const { t } = useTranslation('chargingSite')
  const [isEditMode, setIsEditMode] = useState(addMode)
  const { chargingSiteId } = useParams()
  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles
  } = useCurrentUser()
  const canEdit = hasRoles(roles.supplier)
  const editButtonRoute = canEdit
    ? ROUTES.REPORTS.CHARGING_SITE.EDIT.replace(
        ':chargingSiteId',
        chargingSiteId
      )
    : null
  const orgID = currentUser?.organization?.organizationId

  const handleEditClick = useCallback(() => {
    setIsEditMode(true)
  }, [])

  const handleCancelEdit = useCallback(() => {
    if (addMode) {
      navigate(ROUTES.ORGANIZATIONS.LIST)
    } else {
      setIsEditMode(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const handleSaveSuccess = useCallback((organizationId) => {
    if (addMode) {
      const successMessage = {
        state: {
          message: t('org:addSuccessMessage'),
          severity: 'success'
        }
      }
      setIsEditMode(false)
      organizationId
        ? navigate(
            ROUTES.ORGANIZATIONS.VIEW.replace(':orgID', organizationId),
            successMessage
          )
        : navigate(ROUTES.ORGANIZATIONS.LIST, successMessage)
    } else {
      alertRef.current?.triggerAlert({
        message: t('org:editSuccessMessage'),
        severity: 'success'
      })
      setIsEditMode(false)
      refetch()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  if (isCurrentUserLoading) {
    return <Loading />
  }
  return (
    <BCBox
      sx={{
        mt: 5,
        width: {
          md: '100%',
          lg: '60%'
        }
      }}
    >
      <BCWidgetCard
        title={t('cardTitle')}
        color="nav"
        editButton={undefined}
        content={<ChargingSiteProfile />}
      />
    </BCBox>
  )
}
