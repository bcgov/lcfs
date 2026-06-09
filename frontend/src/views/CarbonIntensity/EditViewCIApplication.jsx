import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
import { ApplicationSummary } from './components/ApplicationSummary'
import { ProposedFuelPathwaysStep } from './components/ProposedFuelPathwaysStep'
import { DocumentsModellingStep } from './components/DocumentsModellingStep'
import { SignAndSubmitStep } from './components/SignAndSubmitStep'
import { GovernmentDecisionStep } from './components/GovernmentDecisionStep'
import { GeneratedFuelCodesSection } from './components/GeneratedFuelCodesSection'
import { StepStub } from './components/StepStub'
import { FuelCodesTabs } from './components/FuelCodesTabs'
import colors from '@/themes/base/colors'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'

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

  const [searchParams, setSearchParams] = useSearchParams()
  const [isDocumentEditorOpen, setIsDocumentEditorOpen] = useState(false)
  const [supplierRequestDate, setSupplierRequestDate] = useState(null)
  const stepFromUrl = (() => {
    const raw = Number.parseInt(searchParams.get('step') ?? '1', 10)
    if (Number.isNaN(raw)) return 0
    return Math.max(0, Math.min(STEP_KEYS.length - 1, raw - 1))
  })()
  const activeStep = stepFromUrl

  const [expanded, setExpanded] = useState([STEP_KEYS[stepFromUrl]])
  const [modalData, setModalData] = useState(null)

  // Sync the expanded accordion when the URL step changes after mount
  // (back/forward navigation). Initial value is already correct via useState.
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    setExpanded([STEP_KEYS[stepFromUrl]])
  }, [stepFromUrl])

  // Once a submitted/terminal application loads, surface the Government
  // decision panel by default — the wizard accordions for Steps 1–4 are
  // hidden in that state, so step1..step4 in `expanded` would render
  // nothing visible. Runs once when the status flips to non-Draft.
  const didSyncSubmittedExpanded = useRef(false)

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

  const { hasAnyRole } = useCurrentUser()
  const isGovernment = !!hasAnyRole?.(
    roles.government,
    roles.analyst,
    roles.compliance_manager,
    roles.director
  )

  const ciApplicationWithSupplierRequest = supplierRequestDate
    ? { ...ciApplication, supplierRequestDate }
    : ciApplication

  const handleAccordionToggle = (key) => (_, isOpen) => {
    setExpanded((prev) =>
      isOpen
        ? Array.from(new Set([...prev, key]))
        : prev.filter((k) => k !== key)
    )
  }

  const goToStep = useCallback(
    (index) => {
      const clamped = Math.max(0, Math.min(STEP_KEYS.length - 1, index))
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('step', String(clamped + 1))
          return next
        },
        { replace: true }
      )
      setExpanded([STEP_KEYS[clamped]])
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [setSearchParams]
  )

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

  const isDraft = ciApplication?.status?.status === 'Draft'
  const isSubmittedOrTerminal = Boolean(
    ciApplication?.status?.status && ciApplication.status.status !== 'Draft'
  )
  const canDelete = !!ciApplicationId && (!ciApplication || isDraft)
  const isDecisionReadOnly =
    ciApplication?.status?.status === 'Completed' ||
    ciApplication?.status?.status === 'Withdrawn'
  const canManageSummaryDocuments =
    isGovernment && isSubmittedOrTerminal && !isDecisionReadOnly

  // Hooks must run on every render — keep this above the loading-state
  // early return so hook order stays stable across renders.
  useEffect(() => {
    if (isSubmittedOrTerminal && !didSyncSubmittedExpanded.current) {
      didSyncSubmittedExpanded.current = true
      setExpanded(['step5', 'summary'])
    }
  }, [isSubmittedOrTerminal])

  if (isLoadingOptions || (!isAdd && isLoadingApplication)) {
    return <Loading />
  }

  const stepBodies = {
    step1: (
      <ApplicationInformationStep
        ciApplication={ciApplication}
        organization={organizationInfo}
        unitsOfMeasure={tableOptions?.unitsOfMeasure || []}
        onSave={handleStep1Save}
        onDelete={canDelete ? openDeleteConfirmation : null}
        isSaving={isSaving || isDeleting}
        readOnly={!isAdd && !isDraft}
      />
    ),
    step2: ciApplicationId ? (
      <ProposedFuelPathwaysStep
        ciApplication={ciApplication}
        optionsData={tableOptions}
        onSave={handleStep2Save}
        onDelete={canDelete ? openDeleteConfirmation : null}
        onValidationError={(message) =>
          alertRef.current?.triggerAlert?.({ message, severity: 'error' })
        }
        isSaving={isSaving || isDeleting}
        readOnly={!isDraft}
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
        readOnly={!isDraft}
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
    step5Decision: isSubmittedOrTerminal ? (
      <GovernmentDecisionStep
        ciApplication={ciApplicationWithSupplierRequest}
        isGovernment={isGovernment}
        readOnly={isDecisionReadOnly}
        onDocumentUploadClick={() => setIsDocumentEditorOpen(true)}
        onSupplierRequest={() =>
          setSupplierRequestDate(new Date().toISOString())
        }
        showComments={false}
        showTitle={false}
      />
    ) : (
      <StepStub titleKey="carbonIntensity:steps.step5" />
    ),
    step5Comments: isSubmittedOrTerminal ? (
      <GovernmentDecisionStep
        ciApplication={ciApplication}
        isGovernment={isGovernment}
        readOnly={isDecisionReadOnly}
        showDecisionPanel={false}
        showTitle={false}
        showCommentsTitle={false}
      />
    ) : (
      <StepStub titleKey="carbonIntensity:steps.step5" />
    ),
    step5: <StepStub titleKey="carbonIntensity:steps.step5" />
  }

  return (
    <Grid2 className="ci-application-edit-container" mx={-1}>
      <FuelCodesTabs />
      <FloatingAlert ref={alertRef} />

      <BCTypography variant="h5" color="primary" data-test="title" my={2}>
        {t('carbonIntensity:carbonIntensityApplication')}
      </BCTypography>

      <CIApplicationProgress
        activeStep={activeStep}
        ciApplication={ciApplicationWithSupplierRequest}
      />

      {!isAdd && ciApplication?.status?.status && (
        <Box mb={2}>
          <BCAlert severity="info">
            {`Status: ${ciApplication.status.status}`}
          </BCAlert>
        </Box>
      )}

      {/*
        On submitted/terminal applications the editable Steps 1–4
        collapse into a single read-only "Application information"
        accordion below the Government decision panel, per the wireframe.
        Drafts (and new applications) keep the full wizard.
      */}
      {isSubmittedOrTerminal ? (
        <>
          {isGovernment && (
            <BCBox mb={3} data-test="ci-step5-decision-inline">
              {stepBodies.step5Decision}
            </BCBox>
          )}
          {isGovernment && ciApplication?.generatedFuelCodes?.length > 0 && (
            <BCBox mb={4} data-test="ci-generated-fuel-codes-inline">
              <Accordion
                key="generatedFuelCodes"
                expanded={expanded.includes('generatedFuelCodes')}
                onChange={handleAccordionToggle('generatedFuelCodes')}
                data-test="ci-generated-fuel-codes-accordion"
              >
                <AccordionSummary
                  expandIcon={
                    <ExpandMore sx={{ width: '2rem', height: '2rem' }} />
                  }
                >
                  <BCTypography
                    style={{ display: 'flex', alignItems: 'center' }}
                    variant="h6"
                    color="primary"
                    component="div"
                  >
                    {t('carbonIntensity:step5.generatedFuelCodesHeader')}
                  </BCTypography>
                </AccordionSummary>
                <AccordionDetails>
                  <BCBox p={1}>
                    <GeneratedFuelCodesSection
                      ciApplication={ciApplication}
                      readOnly={ciApplication?.status?.status !== 'Submitted'}
                    />
                  </BCBox>
                </AccordionDetails>
              </Accordion>
            </BCBox>
          )}
          <BCBox mb={4} data-test="ci-step5-comments-inline">
            <Accordion
              key="step5"
              expanded={expanded.includes('step5')}
              onChange={handleAccordionToggle('step5')}
              data-test="ci-step-accordion-step5"
            >
              <AccordionSummary
                expandIcon={
                  <ExpandMore sx={{ width: '2rem', height: '2rem' }} />
                }
              >
                <BCTypography
                  style={{ display: 'flex', alignItems: 'center' }}
                  variant="h6"
                  color="primary"
                  component="div"
                >
                  {t('carbonIntensity:step5.commentsToOrganizationHeader')}
                </BCTypography>
              </AccordionSummary>
              <AccordionDetails>
                <BCBox p={1}>{stepBodies.step5Comments}</BCBox>
              </AccordionDetails>
            </Accordion>
          </BCBox>
          <BCWidgetCard
            component="div"
            style={{ height: 'fit-content' }}
            title={t('carbonIntensity:summary.header')}
            mt={2}
            sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
            content={
              <BCBox
                sx={{
                  marginTop: '5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2
                }}
              >
                <ApplicationSummary
                  ciApplication={ciApplication}
                  currentUser={currentUser}
                  canEditDocuments={canManageSummaryDocuments}
                  onEditDocuments={() => setIsDocumentEditorOpen(true)}
                />
              </BCBox>
            }
          />
        </>
      ) : (
        CI_APPLICATION_STEPS.map((step, index) => (
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
        ))
      )}

      <BCBox
        sx={{
          mt: 4,
          p: 2,
          bgcolor: 'grey.50',
          border: 1,
          borderColor: 'divider'
        }}
      >
        <BCTypography
          variant="caption"
          color="text.secondary"
          component="pre"
          sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', m: 0 }}
        >
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
      <BCModal
        open={isDocumentEditorOpen}
        onClose={() => setIsDocumentEditorOpen(false)}
        data={
          isDocumentEditorOpen
            ? {
                title: t('carbonIntensity:step3.uploadedHeader'),
                secondaryButtonText: t('common:cancelBtn'),
                secondaryButtonAction: () => setIsDocumentEditorOpen(false),
                content: (
                  <DocumentsModellingStep
                    ciApplication={ciApplication}
                    onSave={async () => {}}
                    isSaving={false}
                    readOnly={false}
                    showTitle={false}
                    showSaveControls={false}
                  />
                )
              }
            : null
        }
      />
    </Grid2>
  )
}

export const EditViewCIApplication = withRole(
  EditViewCIApplicationBase,
  [roles.ci_applicant, roles.government],
  ROUTES.DASHBOARD
)
EditViewCIApplication.displayName = 'EditViewCIApplication'
