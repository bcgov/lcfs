import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box
} from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import Grid2 from '@mui/material/Grid2'

import BCAlert, { FloatingAlert } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { roles } from '@/constants/roles'
import withRole from '@/utils/withRole'
import ROUTES from '@/routes/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useCIApplicationOptions,
  useCreateCIApplication,
  useDeleteCIApplication,
  useGetCIApplication,
  useSubmitCIApplication,
  useUpdateCIApplicationStep1,
  useUpdateCIApplicationStep2,
  useUpdateCIApplicationStep3
} from '@/hooks/useCIApplication'

import {
  CI_APPLICATION_STEPS,
  CIApplicationProgress
} from './components/CIApplicationProgress'
import { ApplicationInformationStep } from './components/ApplicationInformationStep'
import { ProposedFuelPathwaysStep } from './components/ProposedFuelPathwaysStep'
import { DocumentsModellingStep } from './components/DocumentsModellingStep'
import { SignAndSubmitStep } from './components/SignAndSubmitStep'
import { GovernmentDecisionStep } from './components/GovernmentDecisionStep'
import { StepStub } from './components/StepStub'
import { FuelCodesTabs } from './components/FuelCodesTabs'

const STEP_KEYS = CI_APPLICATION_STEPS.map((s) => s.key)

const EditViewCIApplicationBase = () => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  const navigate = useNavigate()
  const alertRef = useRef()
  const { ciApplicationId } = useParams()
  const isAdd = !ciApplicationId

  const { data: currentUser } = useCurrentUser()

  const { data: ciApplication, isLoading: isLoadingApplication } =
    useGetCIApplication(ciApplicationId)
  const { data: tableOptions, isLoading: isLoadingOptions } =
    useCIApplicationOptions()

  const [expanded, setExpanded] = useState([STEP_KEYS[0]])
  const [activeStep, setActiveStep] = useState(0)
  const [modalData, setModalData] = useState(null)

  const { mutateAsync: createDraft, isPending: isCreating } =
    useCreateCIApplication()
  const { mutateAsync: updateStep1, isPending: isUpdating } =
    useUpdateCIApplicationStep1(ciApplicationId)
  const { mutateAsync: updateStep2, isPending: isUpdatingStep2 } =
    useUpdateCIApplicationStep2(ciApplicationId)
  const { mutateAsync: updateStep3, isPending: isUpdatingStep3 } =
    useUpdateCIApplicationStep3(ciApplicationId)
  const { mutateAsync: submitApplication, isPending: isSubmitting } =
    useSubmitCIApplication(ciApplicationId)
  const { mutateAsync: deleteDraft, isPending: isDeleting } =
    useDeleteCIApplication()

  const isSaving =
    isCreating ||
    isUpdating ||
    isUpdatingStep2 ||
    isUpdatingStep3 ||
    isSubmitting

  const { hasRoles } = useCurrentUser()
  const isGovernment = !!hasRoles?.(roles.government)

  const handleAccordionToggle = (key) => (_, isOpen) => {
    setExpanded((prev) =>
      isOpen ? Array.from(new Set([...prev, key])) : prev.filter((k) => k !== key)
    )
  }

  const goToStep = useCallback((index) => {
    const key = STEP_KEYS[index]
    setActiveStep(index)
    setExpanded([key])
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const handleSubmitApplication = useCallback(
    async (payload) => {
      try {
        await submitApplication(payload)
        alertRef.current?.triggerAlert?.({
          message: t('carbonIntensity:step4.submitSuccess'),
          severity: 'success'
        })
        goToStep(4)
      } catch (err) {
        alertRef.current?.triggerAlert?.({
          message:
            err?.response?.data?.detail ||
            err?.message ||
            'Failed to submit application.',
          severity: 'error'
        })
      }
    },
    [submitApplication, goToStep, t]
  )

  const handleStep3Save = useCallback(
    async (payload) => {
      try {
        await updateStep3(payload)
        alertRef.current?.triggerAlert?.({
          message: t('carbonIntensity:step3.saveSuccess'),
          severity: 'success'
        })
        goToStep(3)
      } catch (err) {
        alertRef.current?.triggerAlert?.({
          message:
            err?.response?.data?.detail ||
            err?.message ||
            'Failed to save Step 3.',
          severity: 'error'
        })
      }
    },
    [updateStep3, goToStep, t]
  )

  const handleStep2Save = useCallback(
    async (payload) => {
      try {
        await updateStep2(payload)
        alertRef.current?.triggerAlert?.({
          message: t('carbonIntensity:step2.saveSuccess'),
          severity: 'success'
        })
        goToStep(2)
      } catch (err) {
        alertRef.current?.triggerAlert?.({
          message:
            err?.response?.data?.detail ||
            err?.message ||
            'Failed to save proposed fuel pathways.',
          severity: 'error'
        })
      }
    },
    [updateStep2, goToStep, t]
  )

  const handleStep1Save = useCallback(
    async (payload) => {
      try {
        if (isAdd) {
          const created = await createDraft(payload)
          alertRef.current?.triggerAlert?.({
            message: t('carbonIntensity:step1.saveSuccess'),
            severity: 'success'
          })
          navigate(
            ROUTES.CI_APPLICATIONS.EDIT.replace(
              ':ciApplicationId',
              created.ciApplicationId
            ),
            { replace: true }
          )
        } else {
          await updateStep1(payload)
          alertRef.current?.triggerAlert?.({
            message: t('carbonIntensity:step1.saveSuccess'),
            severity: 'success'
          })
        }
        goToStep(1)
      } catch (err) {
        alertRef.current?.triggerAlert?.({
          message:
            err?.response?.data?.detail ||
            err?.message ||
            'Failed to save application information.',
          severity: 'error'
        })
      }
    },
    [isAdd, createDraft, updateStep1, navigate, goToStep, t]
  )

  const openDeleteConfirmation = () => {
    setModalData({
      primaryButtonAction: handleConfirmDelete,
      primaryButtonText: t('common:deleteBtn'),
      secondaryButtonText: t('common:cancelBtn'),
      title: t('carbonIntensity:step1.deleteConfirmTitle'),
      content: (
        <BCTypography variant="body1">
          {t('carbonIntensity:step1.deleteConfirmText')}
        </BCTypography>
      )
    })
  }

  const handleConfirmDelete = async () => {
    try {
      await deleteDraft(ciApplicationId)
      navigate(ROUTES.CI_APPLICATIONS.LIST, {
        state: {
          message: t('carbonIntensity:step1.deleteConfirmTitle'),
          severity: 'success'
        }
      })
    } catch (err) {
      alertRef.current?.triggerAlert?.({
        message:
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to delete CI application.',
        severity: 'error'
      })
    } finally {
      setModalData(null)
    }
  }

  const organizationInfo = useMemo(() => {
    // Loaded application — backend returns the full org block (name,
    // operating name, email, phone) on `ci_application.organization`.
    if (ciApplication?.organization) return ciApplication.organization
    // Add mode — the current user's `organization` is the
    // OrganizationSummaryResponseSchema, which only carries name and
    // operatingName. Show what we have; email/phone/address fill in
    // after the draft is saved and re-fetched.
    if (currentUser?.organization) {
      const org = currentUser.organization
      return {
        organizationId: org.organizationId,
        name: org.name,
        operatingName: org.operatingName
      }
    }
    return null
  }, [ciApplication, currentUser])

  if (isLoadingOptions || (!isAdd && isLoadingApplication)) {
    return <Loading />
  }

  const isDraft = ciApplication?.status?.status === 'Draft'
  const isSubmittedOrTerminal =
    ciApplication?.status?.status &&
    ciApplication.status.status !== 'Draft'
  const canDelete = !!ciApplicationId && (!ciApplication || isDraft)

  const stepBodies = {
    step1: (
      <ApplicationInformationStep
        ciApplication={ciApplication}
        organization={organizationInfo}
        unitsOfMeasure={tableOptions?.unitsOfMeasure || []}
        onSave={handleStep1Save}
        onDelete={canDelete ? openDeleteConfirmation : null}
        isSaving={isSaving || isDeleting}
      />
    ),
    step2: ciApplicationId ? (
      <ProposedFuelPathwaysStep
        ciApplication={ciApplication}
        optionsData={tableOptions}
        onSave={handleStep2Save}
        onDelete={canDelete ? openDeleteConfirmation : null}
        isSaving={isSaving || isDeleting}
      />
    ) : (
      <StepStub titleKey="carbonIntensity:steps.step2" />
    ),
    step3: ciApplicationId ? (
      <DocumentsModellingStep
        ciApplication={ciApplication}
        onSave={handleStep3Save}
        onDelete={canDelete ? openDeleteConfirmation : null}
        isSaving={isSaving || isDeleting}
      />
    ) : (
      <StepStub titleKey="carbonIntensity:steps.step3" />
    ),
    step4: ciApplicationId ? (
      <SignAndSubmitStep
        ciApplication={ciApplication}
        currentUser={currentUser}
        onSave={handleSubmitApplication}
        onDelete={canDelete ? openDeleteConfirmation : null}
        isSaving={isSaving || isDeleting}
        readOnly={!isDraft}
      />
    ) : (
      <StepStub titleKey="carbonIntensity:steps.step4" />
    ),
    step5: isSubmittedOrTerminal ? (
      <GovernmentDecisionStep
        ciApplication={ciApplication}
        isGovernment={isGovernment}
        readOnly={
          ciApplication?.status?.status === 'Completed' ||
          ciApplication?.status?.status === 'Withdrawn'
        }
      />
    ) : (
      <StepStub titleKey="carbonIntensity:steps.step5" />
    )
  }

  return (
    <Grid2 className="ci-application-edit-container" mx={-1}>
      <FuelCodesTabs />
      <FloatingAlert ref={alertRef} />

      <BCTypography variant="h5" color="primary" data-test="title">
        {t('carbonIntensity:carbonIntensityApplication')}
      </BCTypography>

      <CIApplicationProgress activeStep={activeStep} />

      {!isAdd && ciApplication?.status?.status && (
        <Box mb={2}>
          <BCAlert severity="info">
            {`Status: ${ciApplication.status.status}`}
          </BCAlert>
        </Box>
      )}

      {CI_APPLICATION_STEPS.map((step, index) => (
        <Accordion
          key={step.key}
          expanded={expanded.includes(step.key)}
          onChange={handleAccordionToggle(step.key)}
          data-test={`ci-step-accordion-${step.key}`}
          sx={{ mb: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <BCTypography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {`${index + 1}. ${t(step.labelKey)}`}
            </BCTypography>
          </AccordionSummary>
          <AccordionDetails>
            <BCBox p={1}>{stepBodies[step.key]}</BCBox>
          </AccordionDetails>
        </Accordion>
      ))}

      <BCBox sx={{ mt: 4, p: 2, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}>
        <BCTypography variant="caption" color="text.secondary" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', m: 0 }}>
          {t('carbonIntensity:footer')}
        </BCTypography>
      </BCBox>

      {modalData && (
        <BCModal
          open={!!modalData}
          onClose={() => setModalData(null)}
          data={modalData}
        />
      )}
    </Grid2>
  )
}

export const EditViewCIApplication = withRole(
  EditViewCIApplicationBase,
  [roles.ci_applicant, roles.signing_authority, roles.government],
  ROUTES.DASHBOARD
)
EditViewCIApplication.displayName = 'EditViewCIApplication'
