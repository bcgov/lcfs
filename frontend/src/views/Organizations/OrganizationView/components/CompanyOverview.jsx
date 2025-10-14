import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { TextField, Stack, Box } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import { FloatingAlert } from '@/components/BCAlert'
import { useTranslation } from 'react-i18next'
import {
  useOrganization,
  useUpdateCompanyOverview
} from '@/hooks/useOrganization'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'

export const CompanyOverview = () => {
  const alertRef = useRef(null)
  const { t } = useTranslation(['org', 'common'])
  const { orgID } = useParams()
  const [isEditMode, setIsEditMode] = useState(false)

  const { data: currentUser, hasAnyRole } = useCurrentUser()
  const organizationId = orgID ?? currentUser?.organization?.organizationId

  const {
    data: orgData,
    isLoading,
    isError,
    refetch
  } = useOrganization(organizationId, {
    staleTime: 0,
    cacheTime: 0
  })

  const canEdit = hasAnyRole(
    roles.analyst,
    roles.compliance_manager,
    roles.director
  )

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty }
  } = useForm({
    defaultValues: {
      companyDetails: '',
      companyRepresentationAgreements: '',
      companyActingAsAggregator: '',
      companyAdditionalNotes: ''
    }
  })

  useEffect(() => {
    if (orgData) {
      reset({
        companyDetails: orgData.companyDetails || '',
        companyRepresentationAgreements:
          orgData.companyRepresentationAgreements || '',
        companyActingAsAggregator: orgData.companyActingAsAggregator || '',
        companyAdditionalNotes: orgData.companyAdditionalNotes || ''
      })
    }
  }, [orgData, reset])

  const mutation = useUpdateCompanyOverview(organizationId, {
    onSuccess: () => {
      alertRef.current?.triggerAlert({
        message: t('org:companyOverviewUpdateSuccess'),
        severity: 'success'
      })
      setIsEditMode(false)
      refetch()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    onError: (error) => {
      alertRef.current?.triggerAlert({
        message:
          error.response?.data?.detail ||
          t('org:companyOverviewUpdateError') ||
          'Error updating company overview',
        severity: 'error'
      })
    }
  })

  const onSubmit = (data) => {
    mutation.mutate({
      company_details: data.companyDetails,
      company_representation_agreements: data.companyRepresentationAgreements,
      company_acting_as_aggregator: data.companyActingAsAggregator,
      company_additional_notes: data.companyAdditionalNotes
    })
  }

  const handleEditClick = useCallback(() => {
    setIsEditMode(true)
  }, [])

  const handleCancel = useCallback(() => {
    reset()
    setIsEditMode(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [reset])

  if (isLoading) {
    return <Loading />
  }

  if (isError) {
    return (
      <BCBox p={2}>
        <BCTypography color="error">
          {t('org:errorLoadingOrganization')}
        </BCTypography>
      </BCBox>
    )
  }

  const renderViewMode = () => (
    <BCBox p={2}>
      <Stack spacing={3}>
        <Box>
          <BCTypography variant="body4" component="div">
            <strong>{t('org:companyDetailsLabel')}:</strong>
          </BCTypography>
          <BCTypography
            variant="body4"
            sx={{
              whiteSpace: 'pre-wrap',
              mt: 1,
              color: orgData?.companyDetails ? 'text.primary' : 'text.disabled',
              fontStyle: orgData?.companyDetails ? 'normal' : 'italic'
            }}
          >
            {orgData?.companyDetails || t('org:noInformationProvided')}
          </BCTypography>
        </Box>

        <Box>
          <BCTypography variant="body4" component="div">
            <strong>{t('org:companyRepresentationAgreementsLabel')}:</strong>
          </BCTypography>
          <BCTypography
            variant="body4"
            sx={{
              whiteSpace: 'pre-wrap',
              mt: 1,
              color: orgData?.companyRepresentationAgreements
                ? 'text.primary'
                : 'text.disabled',
              fontStyle: orgData?.companyRepresentationAgreements
                ? 'normal'
                : 'italic'
            }}
          >
            {orgData?.companyRepresentationAgreements ||
              t('org:noInformationProvided')}
          </BCTypography>
        </Box>

        <Box>
          <BCTypography variant="body4" component="div">
            <strong>{t('org:companyActingAsAggregatorLabel')}:</strong>
          </BCTypography>
          <BCTypography
            variant="body4"
            sx={{
              whiteSpace: 'pre-wrap',
              mt: 1,
              color: orgData?.companyActingAsAggregator
                ? 'text.primary'
                : 'text.disabled',
              fontStyle: orgData?.companyActingAsAggregator
                ? 'normal'
                : 'italic'
            }}
          >
            {orgData?.companyActingAsAggregator ||
              t('org:noInformationProvided')}
          </BCTypography>
        </Box>

        <Box>
          <BCTypography variant="body4" component="div">
            <strong>{t('org:companyAdditionalNotesLabel')}:</strong>
          </BCTypography>
          <BCTypography
            variant="body4"
            sx={{
              whiteSpace: 'pre-wrap',
              mt: 1,
              color: orgData?.companyAdditionalNotes
                ? 'text.primary'
                : 'text.disabled',
              fontStyle: orgData?.companyAdditionalNotes ? 'normal' : 'italic'
            }}
          >
            {orgData?.companyAdditionalNotes ||
              t('org:noInformationProvided')}
          </BCTypography>
        </Box>
      </Stack>
    </BCBox>
  )

  const renderEditMode = () => (
    <BCBox p={2}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={3}>
          <Box>
            <BCTypography variant="body4" component="div" sx={{ mb: 1 }}>
              <strong>{t('org:companyDetailsLabel')}:</strong>
            </BCTypography>
            <Controller
              name="companyDetails"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={4}
                  variant="outlined"
                  placeholder={t('org:companyDetailsPlaceholder')}
                />
              )}
            />
          </Box>

          <Box>
            <BCTypography variant="body4" component="div" sx={{ mb: 1 }}>
              <strong>{t('org:companyRepresentationAgreementsLabel')}:</strong>
            </BCTypography>
            <Controller
              name="companyRepresentationAgreements"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={4}
                  variant="outlined"
                  placeholder={t(
                    'org:companyRepresentationAgreementsPlaceholder'
                  )}
                />
              )}
            />
          </Box>

          <Box>
            <BCTypography variant="body4" component="div" sx={{ mb: 1 }}>
              <strong>{t('org:companyActingAsAggregatorLabel')}:</strong>
            </BCTypography>
            <Controller
              name="companyActingAsAggregator"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={4}
                  variant="outlined"
                  placeholder={t('org:companyActingAsAggregatorPlaceholder')}
                />
              )}
            />
          </Box>

          <Box>
            <BCTypography variant="body4" component="div" sx={{ mb: 1 }}>
              <strong>{t('org:companyAdditionalNotesLabel')}:</strong>
            </BCTypography>
            <Controller
              name="companyAdditionalNotes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={4}
                  variant="outlined"
                  placeholder={t('org:companyAdditionalNotesPlaceholder')}
                />
              )}
            />
          </Box>

          <BCBox display="flex" justifyContent="flex-end" mt={2}>
            <BCButton
              type="submit"
              variant="contained"
              size="medium"
              color="primary"
              disabled={!isDirty || mutation.isPending}
              startIcon={
                <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
              }
            >
              <BCTypography variant="button">
                {mutation.isPending ? t('common:saving') : t('common:saveBtn')}
              </BCTypography>
            </BCButton>
            <BCButton
              variant="outlined"
              size="medium"
              color="primary"
              sx={{
                backgroundColor: 'white.main',
                ml: 2
              }}
              onClick={handleCancel}
            >
              <BCTypography variant="subtitle2" textTransform="none">
                {t('common:cancelBtn')}
              </BCTypography>
            </BCButton>
          </BCBox>
        </Stack>
      </form>
    </BCBox>
  )

  return (
    <>
      <FloatingAlert ref={alertRef} data-test="alert-box" />
      <BCBox
        sx={{
          mt: 5,
          width: {
            md: '100%',
            lg: isEditMode ? '100%' : '90%'
          }
        }}
      >
        <BCWidgetCard
          title={t('org:companyOverviewTitle')}
          color="nav"
          editButton={
            canEdit && !isEditMode
              ? {
                  text: t('common:editBtn'),
                  onClick: handleEditClick,
                  id: 'edit-company-overview-button'
                }
              : undefined
          }
          content={isEditMode ? renderEditMode() : renderViewMode()}
        />
      </BCBox>
    </>
  )
}

export default CompanyOverview
