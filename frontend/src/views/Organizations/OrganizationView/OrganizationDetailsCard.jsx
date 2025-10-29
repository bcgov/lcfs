import { useCallback, useEffect, useRef, useState } from 'react'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { buildPath, ROUTES } from '@/routes/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useOrganization,
  useOrganizationBalance
} from '@/hooks/useOrganization'

import { roles } from '@/constants/roles'
import { ORGANIZATION_STATUSES } from '@/constants/statuses'
import { Role } from '@/components/Role'
import { AddEditOrgForm } from '../AddEditOrg/AddEditOrgForm'
import { OrganizationProfile } from './OrganizationProfile'
import BCAlert, { FloatingAlert } from '@/components/BCAlert'

export const OrganizationDetailsCard = ({ addMode = false }) => {
  const alertRef = useRef(null)
  const { t } = useTranslation(['common', 'org'])
  const location = useLocation()
  const [isEditMode, setIsEditMode] = useState(addMode || location?.state?.reportID)
  const navigate = useNavigate()
  const { orgID } = useParams()

  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles
  } = useCurrentUser()

  const {
    data: orgData,
    isLoading,
    refetch
  } = useOrganization(orgID ?? currentUser?.organization?.organizationId, {
    staleTime: 0,
    cacheTime: 0
  })
  const { data: orgBalanceInfo } = useOrganizationBalance(
    orgID ?? currentUser?.organization?.organizationId
  )

  const canEdit = hasRoles(roles.administrator)
  const editButtonRoute = canEdit
    ? buildPath(ROUTES.ORGANIZATIONS.EDIT, {
        orgID: orgID || currentUser?.organization?.organizationId
      })
    : null

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

  if (isLoading) {
    return <Loading />
  }

  return (
    <>
      <FloatingAlert ref={alertRef} data-test="alert-box" />
      <BCBox
        sx={{
          mt: 1,
          width: {
            md: '100%',
            lg: isEditMode ? '100%' : '90%'
          }
        }}
      >
        <BCWidgetCard
          title={
            isEditMode
              ? orgID
                ? t('org:editOrgTitle')
                : t('org:addOrgTitle')
              : t('org:orgDetails')
          }
          color="nav"
          editButton={
            canEdit && !isEditMode
              ? {
                  text: t('org:editBtn'),
                  onClick: handleEditClick,
                  id: 'edit-org-button'
                }
              : undefined
          }
          content={
            isEditMode ? (
              <AddEditOrgForm
                handleSaveSuccess={handleSaveSuccess}
                handleCancelEdit={handleCancelEdit}
              />
            ) : (
              <OrganizationProfile
                hasRoles={hasRoles}
                isCurrentUserLoading={isCurrentUserLoading}
                orgID={orgID ?? currentUser?.organization?.organizationId}
                orgData={orgData}
                orgBalanceInfo={orgBalanceInfo}
              />
            )
          }
        />
      </BCBox>
    </>
  )
}
