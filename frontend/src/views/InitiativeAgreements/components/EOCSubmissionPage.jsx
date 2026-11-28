import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Comments from '@/components/Comments'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import InitiativeAgreementTabs from './InitiativeAgreementTabs'
import DocumentTree from './DocumentTree'
import EOCRequirementSection from './EOCRequirementSection'
import EOCInformationRequestSection from './EOCInformationRequestSection'
import EOCSubmissionHistory from './EOCSubmissionHistory'
import DesignatedActionNavigation from './DesignatedActionNavigation'
import { constructAddress } from '@/utils/constructAddress'
import { dateFormatter } from '@/utils/formatters'

const noValue = '—'

const ApplicantSummary = ({ data, currentUser, readOnly }) => {
  const applicant =
    data.applicant || data.submittedBy || (!readOnly ? currentUser : null) || {}
  const organization =
    data.organizationDetails ||
    data.organization ||
    (!readOnly ? currentUser?.organization : null) ||
    {}
  const organizationName = data.organizationName || organization.name || noValue
  const applicantName =
    applicant.name ||
    [applicant.firstName, applicant.lastName].filter(Boolean).join(' ') ||
    noValue
  const applicantTitle = applicant.title || applicant.roleTitle || ''
  const applicantLine = [applicantName, applicantTitle]
    .filter((part) => part && part !== noValue)
    .join(', ')
  const addressValue =
    data.organizationAddress || organization.address || organization.orgAddress
  const address =
    typeof addressValue === 'string'
      ? addressValue
      : constructAddress(addressValue)
  const phone = applicant.phone || organization.phone
  const email = applicant.email || organization.email

  return (
    <Stack spacing={0.75}>
      <BCTypography variant="h6" color="primary" component="div">
        {organizationName}
      </BCTypography>
      <BCTypography variant="body4" color="primary" sx={{ fontWeight: 700 }}>
        {applicantLine || noValue}
      </BCTypography>
      <BCTypography variant="body4">{address || noValue}</BCTypography>
      <BCTypography variant="body4">{phone || noValue}</BCTypography>
      <BCTypography variant="body4">{email || noValue}</BCTypography>
    </Stack>
  )
}

const SummaryValue = ({ label, value }) => (
  <BCTypography variant="body4" component="p" sx={{ mb: 0.4 }}>
    <strong>{label}</strong> {value || noValue}
  </BCTypography>
)

const responseMapFor = (data) => {
  if (data.evidenceResponses) return data.evidenceResponses
  if (!data.content) return {}
  const firstId = String(data.requirements?.[0]?.id ?? 'completion')
  const legacy = data.content
  return {
    [firstId]: {
      summaryOfWorkCompleted:
        legacy.summaryOfWorkCompleted ?? legacy.summary_of_work_completed ?? '',
      howEvidenceMeetsAgreementRequirements:
        legacy.howEvidenceMeetsAgreementRequirements ??
        legacy.how_evidence_meets_agreement_requirements ??
        '',
      exceptionsLimitationsAndContext:
        legacy.exceptionsLimitationsAndContext ??
        legacy.exceptions_limitations_and_context ??
        ''
    }
  }
}

export const EOCSubmissionPage = ({
  data,
  designatedActionId,
  serverData,
  sections,
  evidenceResponses,
  expanded,
  setExpanded,
  onChange,
  onSave,
  onDownload,
  readOnly = false,
  locked = false,
  saving = false,
  message = '',
  failure = '',
  currentUser,
  isSigner = false,
  declaration = false,
  onDeclarationChange = () => {},
  uploadOpen = false,
  onUploadOpen = () => {},
  onUploadClose = () => {},
  blocker,
  dirty,
  informationRequests = [],
  submissionInformationRequests = {},
  onAnnounce = () => {}
}) => {
  const { t } = useTranslation(['initiativeAgreement', 'report'])
  const actionLabel =
    data.actionLabel || `DA${data.actionNumber}-IA${data.initiativeAgreementId}`
  const summaryDate =
    data.submittedAt || data.submissionDate || data.createDate || null
  const formattedDate = summaryDate
    ? dateFormatter({ value: summaryDate })
    : noValue
  const summaryStep = useMemo(() => {
    if (data.status === 'Draft') return 0
    if (['Not started', 'Submission received'].includes(data.daStatus)) return 1
    return 2
  }, [data.daStatus, data.status])

  // The EOCs government asked more about, open to this user (#5545).
  const openRequests = useMemo(
    () =>
      Object.fromEntries(
        informationRequests
          .filter(
            (request) => request.status === 'Requested' && request.canEdit
          )
          .map((request) => [String(request.evidenceRequirementId), request])
      ),
    [informationRequests]
  )
  const openSections = sections.filter((section) =>
    Boolean(openRequests[String(section.id)])
  )
  const setSectionExpanded = (id, open) =>
    setExpanded((previous) =>
      open
        ? previous.includes(id)
          ? previous
          : [...previous, id]
        : previous.filter((expandedId) => expandedId !== id)
    )
  const goToSection = (id) => {
    setSectionExpanded(id, true)
    window.setTimeout(() => {
      document.getElementById(`eoc-response-heading-${id}`)?.focus()
    }, 0)
  }

  const renderResponseSections = (
    responseData,
    isReadOnly = false,
    responseChange = () => {}
  ) => (
    <Stack spacing={1.5}>
      {sections.map((requirement, index) => {
        const id = String(requirement.id)
        if (!isReadOnly && openRequests[id]) {
          return (
            <EOCInformationRequestSection
              key={`${id}-request-${openRequests[id].id}`}
              designatedActionId={designatedActionId}
              requirement={requirement}
              index={index}
              request={openRequests[id]}
              isSigner={isSigner}
              expanded={expanded.includes(id)}
              setExpanded={(open) => setSectionExpanded(id, open)}
              onAnnounce={onAnnounce}
            />
          )
        }
        return (
          <EOCRequirementSection
            key={id}
            requirement={requirement}
            index={index}
            response={responseData[id] || {}}
            expanded={expanded.includes(id)}
            setExpanded={(open) =>
              setExpanded((previous) =>
                open
                  ? previous.includes(id)
                    ? previous
                    : [...previous, id]
                  : previous.filter((expandedId) => expandedId !== id)
              )
            }
            readOnly={isReadOnly || locked}
            saving={saving}
            onChange={(field, value) => responseChange(id, field, value)}
            onSave={() => onSave(false)}
          />
        )
      })}
    </Stack>
  )

  if (readOnly) {
    const submissions = serverData.submissions?.length
      ? serverData.submissions
      : [
          {
            ...data,
            evidenceResponses: responseMapFor(data),
            requirements: sections
          }
        ]
    return (
      <BCWidgetCard
        title={t('initiativeAgreement:submission.evidenceSectionTitle')}
        color="nav"
        data-test="proponent-eoc-read-only"
        content={
          <EOCSubmissionHistory
            submissions={submissions}
            onDownload={onDownload}
            designatedActionId={designatedActionId}
            informationRequests={submissionInformationRequests}
          />
        }
      />
    )
  }

  return (
    <BCBox data-test="proponent-eoc-page">
      <InitiativeAgreementTabs />
      <BCTypography
        variant="h5"
        color="primary"
        data-test="proponent-eoc-title"
      >
        {t('initiativeAgreement:submission.title')} - {data.iaCode || noValue}
      </BCTypography>
      <Stepper
        alternativeLabel
        activeStep={summaryStep}
        sx={{ my: 4, maxWidth: 1100, mx: 'auto' }}
        data-test="proponent-eoc-stepper"
      >
        {[
          t('initiativeAgreement:submission.steps.applicationInformation'),
          t('initiativeAgreement:submission.steps.signAndSubmit'),
          t('initiativeAgreement:submission.steps.governmentDecision')
        ].map((step) => (
          <Step key={step}>
            <StepLabel>{step}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <BCWidgetCard
        title={t('initiativeAgreement:submission.cardTitle')}
        color="nav"
        data-test="proponent-eoc-card"
        content={
          <BCBox p={1}>
            <BCBox
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2,
                mb: 2
              }}
            >
              <BCBox sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <BCTypography variant="h6" color="primary">
                  {t(
                    'initiativeAgreement:submission.applicantOrganizationInformation'
                  )}
                </BCTypography>
                <Chip
                  size="small"
                  label={
                    data.status || t('initiativeAgreement:submission.draft')
                  }
                  data-test="eoc-status-chip"
                  sx={{ bgcolor: '#d8e9f7', minWidth: 112 }}
                />
              </BCBox>
              <DesignatedActionNavigation
                siblingActionIds={data.siblingActionIds}
                designatedActionId={data.designatedActionId}
                initiativeAgreementId={data.initiativeAgreementId}
                actionNumber={data.actionNumber}
                actionLabel={actionLabel}
                previousTestId="eoc-previous-action"
                nextTestId="eoc-next-action"
              />
            </BCBox>

            <BCBox
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: { xs: 2, md: 6 },
                px: 1,
                py: 1.5,
                minHeight: 155
              }}
            >
              <ApplicantSummary
                data={data}
                currentUser={currentUser}
                readOnly={readOnly}
              />
              <BCBox sx={{ pt: 0.5 }}>
                <SummaryValue
                  label={t(
                    'initiativeAgreement:submission.initiativeAgreement'
                  )}
                  value={data.iaCode}
                />
                <SummaryValue
                  label={t('initiativeAgreement:submission.id')}
                  value={actionLabel}
                />
                <SummaryValue
                  label={t(
                    'initiativeAgreement:submission.designatedActionName'
                  )}
                  value={data.name}
                />
                <SummaryValue
                  label={t('initiativeAgreement:submission.submissionDate')}
                  value={formattedDate}
                />
              </BCBox>
            </BCBox>

            {openSections.length > 0 && (
              <Alert
                severity="warning"
                // Present on load, so a status, not an interrupting alert.
                role="status"
                sx={{ mb: 2 }}
                data-test="eoc-information-request-banner"
              >
                <BCTypography component="p" sx={{ fontWeight: 700 }}>
                  {t('initiativeAgreement:informationRequest.bannerTitle')}
                </BCTypography>
                <BCTypography component="p">
                  {t('initiativeAgreement:informationRequest.bannerBody', {
                    numbers: openSections
                      .map(
                        (section) =>
                          section.requirementNumber ??
                          sections.indexOf(section) + 1
                      )
                      .join(', ')
                  })}
                </BCTypography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {openSections.map((section) => {
                    const number =
                      section.requirementNumber ?? sections.indexOf(section) + 1
                    return (
                      <Link
                        key={section.id}
                        component="button"
                        type="button"
                        variant="body2"
                        onClick={() => goToSection(String(section.id))}
                        sx={{ textDecoration: 'underline' }}
                        data-test={`eoc-information-go-to-${section.id}`}
                      >
                        {t('initiativeAgreement:informationRequest.goToEoc', {
                          number
                        })}
                      </Link>
                    )
                  })}
                </Stack>
              </Alert>
            )}

            {data.revisionRequest && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <BCTypography component="p" sx={{ fontWeight: 700 }}>
                  {t('initiativeAgreement:submission.revisionRequested', {
                    eventType: data.revisionRequest.eventType
                  })}
                </BCTypography>
                <BCTypography component="p">
                  {data.revisionRequest.message}
                </BCTypography>
              </Alert>
            )}

            <Box sx={{ width: { xs: '100%', md: '50%' }, mt: 1.5, mb: 3 }}>
              <DocumentTree
                parentType="designatedAction"
                parentID={designatedActionId}
                title={t('initiativeAgreement:actionDetail.documents')}
                enablePreview
                allowSubfolders
                readOnly={locked}
                headerAction={
                  !locked && (
                    <Link
                      component="button"
                      type="button"
                      variant="body2"
                      onClick={() => onUploadOpen(true)}
                      sx={{
                        textDecoration: 'underline',
                        color: 'primary.main',
                        '&:hover': { color: 'primary.dark' }
                      }}
                    >
                      {t('initiativeAgreement:submission.manageDocuments')}
                    </Link>
                  )
                }
              />
              <DocumentUploadDialog
                open={uploadOpen && !locked}
                close={onUploadClose}
                parentType="designatedAction"
                parentID={designatedActionId}
              />
            </Box>

            <Divider sx={{ my: 3 }} />
            <BCBox
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 2,
                flexWrap: 'wrap',
                mb: 2
              }}
            >
              <BCTypography variant="h6" color="primary">
                {t('initiativeAgreement:submission.evidenceSectionTitle')}
              </BCTypography>
              <Stack direction="row" spacing={0.75}>
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  sx={{ textDecoration: 'underline', color: 'primary.main' }}
                  onClick={() =>
                    setExpanded(sections.map((section) => section.id))
                  }
                >
                  {t('initiativeAgreement:submission.expandAll')}
                </Link>
                <BCTypography component="span" color="text.secondary">
                  |
                </BCTypography>
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  sx={{ textDecoration: 'underline', color: 'primary.main' }}
                  onClick={() => setExpanded([])}
                >
                  {t('initiativeAgreement:submission.collapseAll')}
                </Link>
              </Stack>
            </BCBox>

            {renderResponseSections(evidenceResponses, false, onChange)}

            {failure && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {failure}
              </Alert>
            )}
            <BCTypography
              component="p"
              role="status"
              aria-live="polite"
              sx={{ mt: 1 }}
            >
              {saving ? t('initiativeAgreement:submission.saving') : message}
            </BCTypography>

            {isSigner && !locked && (
              <Paper
                variant="outlined"
                sx={{ mt: 3, p: 2, borderColor: 'grey.500' }}
                data-test="eoc-signature-panel"
              >
                <BCTypography variant="h6" color="primary" sx={{ mb: 1 }}>
                  {t('initiativeAgreement:submission.declarationTitle')}
                </BCTypography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={declaration}
                      disabled={saving || locked}
                      onChange={(event) =>
                        onDeclarationChange(event.target.checked)
                      }
                      data-test="eoc-signing-declaration"
                    />
                  }
                  label={t('initiativeAgreement:submission.declarationText')}
                  sx={{ alignItems: 'flex-start', mb: 1 }}
                />
                <BCButton
                  variant="contained"
                  color="primary"
                  disabled={!declaration || saving || locked}
                  onClick={() => onSave(true).catch(() => {})}
                  data-test="submit-evidence-button"
                >
                  {t('initiativeAgreement:submission.submitEvidence')}
                </BCButton>
              </Paper>
            )}
          </BCBox>
        }
      />

      <EOCSubmissionHistory
        submissions={serverData.submissions || []}
        onDownload={onDownload}
        designatedActionId={designatedActionId}
        informationRequests={submissionInformationRequests}
      />

      <BCBox mt={3} data-test="eoc-comments-section">
        <BCTypography variant="h6" color="primary" mb={1.5}>
          {t('initiativeAgreement:submission.commentsTitle')}
        </BCTypography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Comments
            entityType="designatedAction"
            entityId={Number(designatedActionId)}
            commentMode="dual"
            enableAttachments={false}
          />
        </Paper>
      </BCBox>

      <Dialog
        open={blocker?.state === 'blocked'}
        onClose={() => blocker?.reset?.()}
        aria-labelledby="eoc-navigation-dialog-title"
      >
        <DialogTitle id="eoc-navigation-dialog-title">
          {t('initiativeAgreement:submission.unsavedTitle')}
        </DialogTitle>
        <DialogContent>
          <BCTypography component="p">
            {failure
              ? t('initiativeAgreement:submission.unsavedFailed')
              : t('initiativeAgreement:submission.unsavedPrompt')}
          </BCTypography>
          {failure && <Alert severity="error">{failure}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => blocker?.reset?.()}>
            {t('initiativeAgreement:submission.stayOnPage')}
          </Button>
          <Button
            color="error"
            onClick={() => {
              if (dirty) dirty.current = false
              blocker?.proceed?.()
            }}
          >
            {t('initiativeAgreement:submission.discardAndLeave')}
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={async () => {
              try {
                if (dirty?.current) await onSave(false)
                blocker?.proceed?.()
              } catch {
                // Keep navigation blocked so the user can retry or discard.
              }
            }}
          >
            {saving
              ? t('initiativeAgreement:submission.saving')
              : t('initiativeAgreement:submission.saveAndLeave')}
          </Button>
        </DialogActions>
      </Dialog>
    </BCBox>
  )
}

export default EOCSubmissionPage
