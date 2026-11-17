import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useParams } from 'react-router-dom'
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Stack,
  Stepper,
  Step,
  StepLabel
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useApiService } from '@/services/useApiService'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { apiRoutes } from '@/constants/routes'
import { roles } from '@/constants/roles'
import BCTypography from '@/components/BCTypography'
import BCBox from '@/components/BCBox'
import Loading from '@/components/Loading'
import Comments from '@/components/Comments'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import { DocumentTree } from './DocumentTree'

export const ProponentEOC = ({ designatedActionId, readOnly = false }) => {
  const api = useApiService()
  const queryClient = useQueryClient()
  const { hasRoles } = useCurrentUser()
  const { initiativeAgreementId } = useParams()
  const url = apiRoutes.getDesignatedActionProfile
    .replace(':designatedActionId', designatedActionId)
    .replace('/profile', '/eoc')
  const queryKey = useMemo(
    () => ['designated-action-eoc', String(designatedActionId)],
    [designatedActionId]
  )
  const {
    data: serverData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey,
    queryFn: async () => (await api.get(url)).data
  })
  // IDIR reads the latest immutable submission while a revision is drafted.
  const data = useMemo(() => {
    const lastSubmission = serverData?.submissions?.[0]
    return readOnly && lastSubmission
      ? {
          ...serverData,
          ...lastSubmission,
          status: 'Submitted',
          canEdit: false
        }
      : serverData
  }, [readOnly, serverData])
  const [content, setContent] = useState({})
  const [expanded, setExpanded] = useState([])
  const [declaration, setDeclaration] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [saving, setSaving] = useState(false)
  const editorRefs = useRef({})
  const dirty = useRef(false)
  const latest = useRef({})
  const queue = useRef(Promise.resolve())
  const locked =
    readOnly || data?.canEdit === false || data?.status === 'Submitted'
  const blocker = useBlocker(() => !readOnly && dirty.current)
  useEffect(() => {
    if (data && (readOnly || !dirty.current)) {
      latest.current = data.content || {}
      setContent(latest.current)
    }
  }, [data, readOnly])
  useEffect(() => {
    for (const [requirementId, editorRef] of Object.entries(
      editorRefs.current
    )) {
      const editor = editorRef?.getEditor?.()
      const toolbar = editor?.getModule('toolbar')?.container
      if (!toolbar) continue
      toolbar.setAttribute('role', 'toolbar')
      toolbar.setAttribute('aria-label', 'Evidence formatting toolbar')
      toolbar.querySelectorAll('button').forEach((button) => {
        const format = button.className
          .split(/\s+/)
          .find((className) => className.startsWith('ql-'))
          ?.slice(3)
        const labels = {
          bold: 'Bold',
          italic: 'Italic',
          list: button.value === 'ordered' ? 'Numbered list' : 'Bulleted list',
          link: 'Insert link'
        }
        if (format && labels[format]) {
          button.setAttribute('aria-label', labels[format])
        }
      })
      toolbar.setAttribute('data-requirement-id', requirementId)
    }
  }, [content, expanded, locked, saving])
  const downloadSubmissionDocument = async (submissionId, document) => {
    try {
      const response = await api.get(
        `${url}/submissions/${submissionId}/documents/${document.documentId}`,
        { responseType: 'blob' }
      )
      const href = URL.createObjectURL(response.data)
      const link = window.document.createElement('a')
      link.href = href
      link.download = document.fileName
      link.click()
      URL.revokeObjectURL(href)
    } catch {
      setFailure('Unable to download the submitted document.')
    }
  }
  const save = useCallback(
    (submit = false) => {
      const snapshot = { ...latest.current }
      setSaving(true)
      setFailure('')
      const task = queue.current
        .catch(() => {})
        .then(async () => {
          const body = {
            summaryOfWorkCompleted: snapshot.summary_of_work_completed || '',
            howEvidenceMeetsAgreementRequirements:
              snapshot.how_evidence_meets_agreement_requirements || '',
            exceptionsLimitationsAndContext:
              snapshot.exceptions_limitations_and_context || '',
            declarationAccepted: submit && declaration
          }
          const response = submit
            ? await api.post(`${url}/submit`, body)
            : await api.put(url, body)
          if (response.data?.content) {
            queryClient.setQueryData(queryKey, response.data)
          }
          if (JSON.stringify(latest.current) === JSON.stringify(snapshot)) {
            dirty.current = false
            latest.current = response.data?.content || snapshot
            setContent(latest.current)
          }
          setMessage(submit ? 'Evidence submitted.' : 'Draft saved.')
          if (submit) {
            setDeclaration(false)
            await refetch()
          }
        })
      queue.current = task
      task
        .catch((e) =>
          setFailure(
            e?.response?.data?.detail ||
              'Unable to save evidence. Your changes are still on this page.'
          )
        )
        .finally(() => setSaving(false))
      return task
    },
    [api, url, declaration, queryClient, queryKey, refetch]
  )
  useEffect(() => {
    if (locked || !dirty.current) return
    const timer = setTimeout(() => {
      save().catch(() => {})
    }, 1000)
    return () => clearTimeout(timer)
  }, [content, locked, save])
  useEffect(() => {
    const warn = (event) => {
      if (dirty.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  if (isLoading) return <Loading />
  if (error) return <Alert severity="error">Unable to load evidence.</Alert>
  if (!data || (readOnly && data.status !== 'Submitted')) return null
  if (
    initiativeAgreementId &&
    Number(initiativeAgreementId) !== data.initiativeAgreementId
  )
    return (
      <Alert severity="error">
        Designated action does not belong to this agreement.
      </Alert>
    )
  const sections = data.requirements.length
    ? data.requirements
    : [{ id: 'completion', title: 'Evidence of completion' }]
  const change = (key, value) => {
    dirty.current = true
    latest.current = { ...latest.current, [key]: value }
    setContent(latest.current)
    setMessage('Unsaved changes')
  }
  return (
    <BCBox mt={3}>
      <BCTypography variant="h5">Evidence of completion</BCTypography>
      {!readOnly && (
        <>
          <Stepper
            activeStep={data.status === 'Submitted' ? 1 : 0}
            sx={{ my: 3 }}
          >
            {['Draft', 'Submitted'].map((status) => (
              <Step key={status}>
                <StepLabel>{status}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Stack spacing={1} mb={3}>
            <BCTypography component="p">
              Organization: {data.organizationName}
            </BCTypography>
            <BCTypography component="p">
              Initiative agreement: {data.iaCode}
            </BCTypography>
            <BCTypography component="p">
              DA{data.actionNumber}-IA{data.initiativeAgreementId}: {data.name}
            </BCTypography>
            <BCTypography component="p">
              DA review status: {data.daStatus}
            </BCTypography>
            <BCTypography component="p">
              Status:{' '}
              <Chip
                size="small"
                label={data.status}
                color={data.status === 'Submitted' ? 'success' : 'default'}
              />
            </BCTypography>
            <BCTypography component="p">
              Submission date:{' '}
              {data.submittedAt
                ? new Date(data.submittedAt).toLocaleString()
                : '—'}
            </BCTypography>
          </Stack>
          <DocumentTree
            parentType="designatedAction"
            parentID={designatedActionId}
            enablePreview
            allowSubfolders
            readOnly={locked}
            headerAction={
              !locked && (
                <Button onClick={() => setUploadOpen(true)}>
                  Manage documents
                </Button>
              )
            }
          />
          <DocumentUploadDialog
            open={uploadOpen && !locked}
            close={() => {
              setUploadOpen(false)
              queryClient.invalidateQueries({
                queryKey: [
                  'document-tree',
                  'designatedAction',
                  String(designatedActionId)
                ]
              })
            }}
            parentType="designatedAction"
            parentID={designatedActionId}
          />
        </>
      )}
      {readOnly &&
        data.documents?.map((document) => (
          <Button
            key={document.documentId}
            onClick={() => downloadSubmissionDocument(data.id, document)}
          >
            {document.fileName}
          </Button>
        ))}
      <Button onClick={() => setExpanded(sections.map((r) => r.id))}>
        Expand all
      </Button>
      <Button onClick={() => setExpanded([])}>Collapse all</Button>
      {sections.map((requirement) => (
        <Accordion
          key={requirement.id}
          expanded={expanded.includes(requirement.id)}
          onChange={(_, open) =>
            setExpanded((ids) =>
              open
                ? [...ids, requirement.id]
                : ids.filter((id) => id !== requirement.id)
            )
          }
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            id={`eoc-heading-${requirement.id}`}
            aria-controls={`eoc-section-${requirement.id}`}
          >
            {requirement.title || 'Evidence of completion'}
          </AccordionSummary>
          <AccordionDetails id={`eoc-section-${requirement.id}`}>
            <BCTypography component="p">{requirement.description}</BCTypography>
            <label id={`eoc-label-${requirement.id}`}>
              Evidence of completion response
            </label>
            <div role="group" aria-labelledby={`eoc-label-${requirement.id}`}>
              <ReactQuill
                ref={(editor) => {
                  editorRefs.current[String(requirement.id)] = editor
                }}
                theme="snow"
                readOnly={locked || saving}
                value={content[String(requirement.id)] || ''}
                onChange={(value) => {
                  if (!locked && !saving) change(String(requirement.id), value)
                }}
                modules={{
                  toolbar: locked
                    ? false
                    : [
                        ['bold', 'italic'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        ['link']
                      ]
                }}
              />
            </div>
          </AccordionDetails>
        </Accordion>
      ))}
      {failure && <Alert severity="error">{failure}</Alert>}
      <BCTypography component="p" role="status" aria-live="polite">
        {saving ? 'Saving…' : message}
      </BCTypography>
      {!locked && (
        <Stack spacing={2} my={3}>
          <Button
            variant="outlined"
            disabled={saving}
            onClick={() => save().catch(() => {})}
          >
            Save to draft
          </Button>
          {hasRoles?.(roles.ia_signer) && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={declaration}
                  disabled={saving}
                  onChange={(event) => setDeclaration(event.target.checked)}
                />
              }
              label="Signing authority declaration: I certify that the information and evidence provided are complete and accurate, and I am authorized to submit on behalf of my organization."
            />
          )}
          <Button
            variant="contained"
            disabled={!hasRoles?.(roles.ia_signer) || !declaration || saving}
            onClick={() => save(true).catch(() => {})}
          >
            Submit application
          </Button>
        </Stack>
      )}
      {serverData.submissions?.length > 0 && (
        <BCBox mt={3}>
          <BCTypography variant="h6">Submission history</BCTypography>
          {serverData.submissions.map((submission) => (
            <Accordion key={submission.id}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                Submitted {new Date(submission.submittedAt).toLocaleString()}
              </AccordionSummary>
              <AccordionDetails>
                {submission.documents?.map((document) => (
                  <Button
                    key={document.documentId}
                    onClick={() =>
                      downloadSubmissionDocument(submission.id, document)
                    }
                  >
                    {[...(document.folderPath || []), document.fileName].join(
                      ' / '
                    )}
                  </Button>
                ))}
                {submission.requirements.map((requirement) => (
                  <BCBox key={requirement.id} mb={2}>
                    <BCTypography component="p">
                      {requirement.title || requirement.description}
                    </BCTypography>
                    <ReactQuill
                      theme="snow"
                      readOnly
                      value={submission.content[String(requirement.id)] || ''}
                      modules={{ toolbar: false }}
                    />
                  </BCBox>
                ))}
                {!submission.requirements.length && (
                  <ReactQuill
                    theme="snow"
                    readOnly
                    value={submission.content.completion || ''}
                    modules={{ toolbar: false }}
                  />
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </BCBox>
      )}
      {!readOnly && (
        <BCBox mt={3}>
          <BCTypography variant="h6">
            Comments to the Government of B.C.
          </BCTypography>
          <Comments
            entityType="designatedAction"
            entityId={Number(designatedActionId)}
            commentMode="dual"
            enableAttachments={false}
          />
        </BCBox>
      )}
      <Dialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        aria-labelledby="eoc-navigation-dialog-title"
      >
        <DialogTitle id="eoc-navigation-dialog-title">
          Unsaved evidence changes
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {failure
              ? 'Your latest changes could not be saved. Save them again or discard them before leaving.'
              : 'Save your evidence before leaving this page, or discard your changes.'}
          </DialogContentText>
          {failure && <Alert severity="error">{failure}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>Stay on page</Button>
          <Button
            color="error"
            onClick={() => {
              dirty.current = false
              blocker.proceed?.()
            }}
          >
            Discard changes and leave
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={async () => {
              try {
                if (dirty.current) await save()
                blocker.proceed?.()
              } catch {
                // Keep the navigation blocked so the user can retry or discard.
              }
            }}
          >
            {saving ? 'Saving…' : 'Save and leave'}
          </Button>
        </DialogActions>
      </Dialog>
    </BCBox>
  )
}
