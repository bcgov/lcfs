import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import type { FieldPath } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import ExpandMore from '@mui/icons-material/ExpandMore'
import BCAlert, { FloatingAlert } from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import Comments from '@/components/Comments'
import Loading from '@/components/Loading'
import { lcjfipBceidRoles, lcjfipIdirRoles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useDeleteLCJFIPApplication,
  useLCJFIPApplication,
  useLCJFIPFuelCodes,
  useLCJFIPReferenceData,
  useSaveLCJFIPApplication,
  useSubmitLCJFIPApplication,
  type LCJFIPApplication as Application,
  type LCJFIPFuelCodeOption
} from '@/hooks/useLCJFIP'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import ROUTES from '@/routes/routes'
import withRole from '@/utils/withRole'
import {
  ApplicantSection,
  type ApplicantInfo
} from './components/ApplicantSection'
import { ApplicationProgress } from './components/ApplicationProgress'
import {
  IncentiveSection,
  type SupplierOrganization
} from './components/IncentiveSection'
import { PurchaseDetailsTable } from './components/PurchaseDetailsTable'
import { SigningSection } from './components/SigningSection'
import {
  DEFAULT_MAX_PREMIUM_RANGE,
  buildSchema,
  defaultFormValues,
  formFieldFromServerField,
  formValuesFromApplication,
  toDeclarations,
  toPayload,
  type LCJFIPFormValues,
  type ValidationContext
} from './lcjfipForm'

type AlertHandle = {
  triggerAlert: (payload: {
    severity: 'success' | 'error' | 'info' | 'warning'
    message: string
  }) => void
}

type ServerError = {
  response?: {
    data?: {
      errors?: { fields?: string[]; message?: string }[]
      detail?: unknown
    }
  }
}

const cardSx = { p: { xs: 2, md: 3 }, mb: 3 }

const fullName = (first?: string | null, last?: string | null) =>
  [first, last].filter(Boolean).join(' ')

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-CA', {
        timeZone: 'America/Vancouver'
      })
    : ''

export const LCJFIPApplicationBase = () => {
  const { t } = useTranslation(['lcjfip', 'common'])
  const navigate = useNavigate()
  const location = useLocation()
  const { applicationId } = useParams<{ applicationId?: string }>()
  const alertRef = useRef<AlertHandle | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: currentUser } = useCurrentUser()
  const isGovernment = !!currentUser?.isGovernmentUser
  const referenceQuery = useLCJFIPReferenceData()
  const applicationQuery = useLCJFIPApplication(applicationId)
  const { data: fuelCodeOptions = [] } = useLCJFIPFuelCodes()
  const { data: supplierData } = useRegExtOrgs({ enabled: !isGovernment })
  const saveMutation = useSaveLCJFIPApplication()
  const submitMutation = useSubmitLCJFIPApplication()
  const deleteMutation = useDeleteLCJFIPApplication()

  const referenceData = referenceQuery.data
  const application = applicationQuery.data
  const readOnly =
    isGovernment || (!!application && application.status !== 'Draft')
  const busy =
    saveMutation.isPending ||
    submitMutation.isPending ||
    deleteMutation.isPending

  // The resolver reads this object on every validation. Save checks formats
  // only; Submit sets `submit` to also check completeness.
  const validationContext = useRef<ValidationContext>({
    submit: false,
    supplierOptionIds: [],
    maxPremiumRange: DEFAULT_MAX_PREMIUM_RANGE
  })
  validationContext.current.supplierOptionIds = (
    referenceData?.incentiveOptions ?? []
  )
    .filter((option) => option.requiresFuelSupplier)
    .map((option) => option.id)
  validationContext.current.maxPremiumRange =
    referenceData?.maxPricePremiumRange ?? DEFAULT_MAX_PREMIUM_RANGE

  const schema = useMemo(() => buildSchema(t), [t])
  const methods = useForm<LCJFIPFormValues>({
    resolver: yupResolver(schema) as never,
    defaultValues: defaultFormValues(),
    context: validationContext.current,
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  })

  // Put a saved application into the form. Declarations are not saved, so
  // they are kept.
  const { reset, getValues } = methods
  const syncForm = useCallback(
    (saved: Application) =>
      reset({
        ...formValuesFromApplication(saved),
        declarations: getValues('declarations')
      }),
    [reset, getValues]
  )

  // Load each application into the form once. Save and submit re-sync it
  // themselves (so new purchase rows carry their ids) before any server
  // errors are shown, which a later reset would otherwise clear.
  const loadedApplicationId = useRef<number | null>(null)
  useEffect(() => {
    if (!application) return
    if (loadedApplicationId.current === application.lcjfipApplicationId) return
    loadedApplicationId.current = application.lcjfipApplicationId
    syncForm(application)
  }, [application, syncForm])

  useEffect(() => {
    const state = location.state as {
      message?: string
      severity?: string
    } | null
    if (state?.message) {
      alertRef.current?.triggerAlert({
        message: state.message,
        severity: (state.severity as 'success') ?? 'success'
      })
    }
  }, [location.state])

  const applyServerErrors = (error: unknown) => {
    const errors = (error as ServerError)?.response?.data?.errors
    if (!Array.isArray(errors)) return false
    for (const entry of errors) {
      for (const field of entry.fields ?? []) {
        methods.setError(
          formFieldFromServerField(field) as FieldPath<LCJFIPFormValues>,
          {
            type: 'server',
            message: entry.message
          }
        )
      }
    }
    return true
  }

  const showError = (error: unknown, fallbackKey: string) => {
    const handled = applyServerErrors(error)
    alertRef.current?.triggerAlert({
      severity: 'error',
      message: handled ? t('lcjfip:messages.fixErrors') : t(fallbackKey)
    })
  }

  const showInvalid = () =>
    alertRef.current?.triggerAlert({
      severity: 'error',
      message: t('lcjfip:messages.fixErrors')
    })

  const saveValues = async (values: LCJFIPFormValues) =>
    saveMutation.mutateAsync({
      applicationId: application?.lcjfipApplicationId,
      payload: toPayload(values)
    })

  const openSaved = (saved: Application, message: string) => {
    if (!application) {
      navigate(
        ROUTES.LCJFIP.APPLICATION.replace(
          ':applicationId',
          String(saved.lcjfipApplicationId)
        ),
        { replace: true, state: { message, severity: 'success' } }
      )
    } else {
      alertRef.current?.triggerAlert({ severity: 'success', message })
    }
  }

  const handleSave = async () => {
    validationContext.current.submit = false
    await methods.handleSubmit(async (values) => {
      try {
        const saved = await saveValues(values)
        syncForm(saved)
        openSaved(saved, t('lcjfip:messages.saved'))
      } catch (error) {
        showError(error, 'lcjfip:messages.saveFailed')
      }
    }, showInvalid)()
  }

  const handleSubmitApplication = async () => {
    validationContext.current.submit = true
    await methods.handleSubmit(
      async (values) => {
        try {
          // Submission checks what was saved, so save the form first.
          const saved = await saveValues(values)
          syncForm(saved)
          const submitted = await submitMutation.mutateAsync({
            applicationId: saved.lcjfipApplicationId,
            declarations: toDeclarations(values.declarations)
          })
          syncForm(submitted)
          openSaved(submitted, t('lcjfip:messages.submitted'))
        } catch (error) {
          showError(error, 'lcjfip:messages.submitFailed')
        } finally {
          validationContext.current.submit = false
        }
      },
      () => {
        validationContext.current.submit = false
        showInvalid()
      }
    )()
  }

  const handleDelete = async () => {
    if (!application) return
    try {
      await deleteMutation.mutateAsync(application.lcjfipApplicationId)
      navigate(ROUTES.LCJFIP.MAIN, {
        state: { message: t('lcjfip:messages.deleted'), severity: 'success' }
      })
    } catch (error) {
      showError(error, 'lcjfip:messages.deleteFailed')
    }
  }

  const applicant: ApplicantInfo = application
    ? {
        organizationName: application.organization?.name,
        contactName: fullName(
          application.contact?.firstName,
          application.contact?.lastName
        ),
        contactTitle: application.contact?.title,
        addressLine: application.organization?.addressLine,
        phone: application.contact?.phone || application.organization?.phone,
        email: application.contact?.email || application.organization?.email
      }
    : {
        organizationName: currentUser?.organization?.name,
        contactName: fullName(currentUser?.firstName, currentUser?.lastName),
        contactTitle: currentUser?.title,
        phone: currentUser?.phone,
        email: currentUser?.email ?? currentUser?.keycloakEmail
      }

  // A fuel code already on the application stays listed if it has expired.
  const fuelCodes = useMemo<LCJFIPFuelCodeOption[]>(() => {
    const current = application?.fuelCode
    if (
      current &&
      !fuelCodeOptions.some((o) => o.fuelCodeId === current.fuelCodeId)
    ) {
      return [current, ...fuelCodeOptions]
    }
    return fuelCodeOptions
  }, [application?.fuelCode, fuelCodeOptions])

  const suppliers = (
    Array.isArray(supplierData) ? supplierData : []
  ) as SupplierOrganization[]

  if (
    referenceQuery.isLoading ||
    (applicationId && applicationQuery.isLoading)
  ) {
    return <Loading />
  }
  if (referenceQuery.isError || applicationQuery.isError || !referenceData) {
    return <BCAlert severity="error">{t('lcjfip:messages.loadFailed')}</BCAlert>
  }

  const submittedLine =
    application && application.status !== 'Draft' && application.signedDate
      ? t('lcjfip:signing.submittedOn', {
          date: formatDate(application.signedDate),
          name: application.signedBy ?? ''
        })
      : null

  return (
    <FormProvider {...methods}>
      <FloatingAlert ref={alertRef as never} />
      <BCTypography
        variant="h5"
        component="h2"
        color="primary"
        data-test="lcjfip-application-title"
      >
        {t('lcjfip:applicationTitle')}
        {application && (
          <BCTypography
            component="span"
            variant="h6"
            color="text.secondary"
            ml={2}
          >
            {application.applicationNumber}
          </BCTypography>
        )}
      </BCTypography>

      <ApplicationProgress status={application?.status} />

      {readOnly && application && !isGovernment && (
        <BCAlert severity="info" sx={{ mb: 2 }} data-test="lcjfip-read-only">
          {t('lcjfip:messages.readOnly')}
        </BCAlert>
      )}

      <BCTypography variant="body2" mb={3}>
        {t('lcjfip:eligibilityMessage')}
      </BCTypography>

      <form noValidate onSubmit={(event) => event.preventDefault()}>
        <Paper variant="outlined" sx={cardSx}>
          <ApplicantSection
            applicant={applicant}
            carTypes={referenceData.carTypes}
            certificateTypes={referenceData.certificateTypes}
            readOnly={readOnly}
          />
          <Divider sx={{ my: 3 }} />
          <PurchaseDetailsTable
            feedstockSources={referenceData.feedstockSources}
            maxPremiumRange={referenceData.maxPricePremiumRange}
            readOnly={readOnly}
          />
          <Divider sx={{ my: 3 }} />
          <IncentiveSection
            incentiveOptions={referenceData.incentiveOptions}
            rates={referenceData.incentiveRates}
            fuelCodes={fuelCodes}
            suppliers={suppliers}
            readOnly={readOnly}
          />
          {!readOnly && (
            <BCButton
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={busy}
              sx={{ mt: 3 }}
              data-test="lcjfip-save"
            >
              {t('lcjfip:actions.save')}
            </BCButton>
          )}
        </Paper>

        {!isGovernment && (
          <Paper variant="outlined" sx={cardSx}>
            <SigningSection
              readOnly={readOnly}
              canDelete={!!application && application.status === 'Draft'}
              busy={busy}
              submittedLine={submittedLine}
              onSubmit={handleSubmitApplication}
              onDelete={() => setDeleteOpen(true)}
            />
          </Paper>
        )}
      </form>

      <Accordion defaultExpanded sx={{ mb: 3 }} data-test="lcjfip-comments">
        <AccordionSummary
          expandIcon={<ExpandMore sx={{ width: '2rem', height: '2rem' }} />}
        >
          <BCTypography variant="h6" component="h3" color="primary">
            {isGovernment
              ? t('lcjfip:comments.toOrganization')
              : t('lcjfip:comments.toGovernment')}
          </BCTypography>
        </AccordionSummary>
        <AccordionDetails>
          {application ? (
            <Comments
              entityType="lcjfipApplication"
              entityId={application.lcjfipApplicationId}
              commentMode="dual"
            />
          ) : (
            <BCTypography variant="body2" color="text.secondary">
              {t('lcjfip:comments.afterSave')}
            </BCTypography>
          )}
        </AccordionDetails>
      </Accordion>

      <BCModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        data={{
          title: t('lcjfip:messages.deleteConfirmTitle'),
          content: (
            <BCTypography variant="body1">
              {t('lcjfip:messages.deleteConfirmText')}
            </BCTypography>
          ),
          primaryButtonText: t('lcjfip:actions.delete'),
          primaryButtonColor: 'error',
          primaryButtonAction: handleDelete,
          secondaryButtonText: t('common:cancelBtn')
        }}
      />
    </FormProvider>
  )
}

// Applicants open and edit their organization's applications. IDIR program
// staff can read a submitted one; their review screens are a later card.
export const LCJFIPApplication = withRole(
  LCJFIPApplicationBase,
  [...lcjfipBceidRoles, ...lcjfipIdirRoles],
  ROUTES.DASHBOARD
)
LCJFIPApplication.displayName = 'LCJFIPApplication'

export default LCJFIPApplication
