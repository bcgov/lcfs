import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useParams } from 'react-router-dom'
import { Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useApiService } from '@/services/useApiService'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { apiRoutes } from '@/constants/routes'
import { roles } from '@/constants/roles'
import Loading from '@/components/Loading'
import EOCSubmissionPage from './EOCSubmissionPage'

const EMPTY_RESPONSE = {
  summaryOfWorkCompleted: '',
  howEvidenceMeetsAgreementRequirements: '',
  exceptionsLimitationsAndContext: ''
}

const requirementId = (requirement) =>
  String(requirement.id ?? requirement.evidenceRequirementId)

const evidenceResponsesFor = (payload, sections) => {
  if (payload?.evidenceResponses) return payload.evidenceResponses
  const legacyContent = payload?.content
  if (!legacyContent) return {}
  const fields = {
    summaryOfWorkCompleted:
      legacyContent.summaryOfWorkCompleted ??
      legacyContent.summary_of_work_completed ??
      '',
    howEvidenceMeetsAgreementRequirements:
      legacyContent.howEvidenceMeetsAgreementRequirements ??
      legacyContent.how_evidence_meets_agreement_requirements ??
      '',
    exceptionsLimitationsAndContext:
      legacyContent.exceptionsLimitationsAndContext ??
      legacyContent.exceptions_limitations_and_context ??
      ''
  }
  return { [sections[0]?.id ?? 'completion']: fields }
}

export const ProponentEOC = ({ designatedActionId, readOnly = false }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement', 'report'])
  const api = useApiService()
  const queryClient = useQueryClient()
  const { hasRoles, data: currentUser } = useCurrentUser()
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
  const [evidenceResponses, setEvidenceResponses] = useState({})
  const [expanded, setExpanded] = useState([])
  const [declaration, setDeclaration] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [saving, setSaving] = useState(false)
  const autoSaveTimer = useRef(null)
  const dirty = useRef(false)
  const latest = useRef({})
  const queue = useRef(Promise.resolve())
  const initializedAccordionForAction = useRef(null)
  const locked =
    readOnly || data?.canEdit === false || data?.status === 'Submitted'
  const blocker = useBlocker(() => !readOnly && dirty.current)
  const sections = useMemo(() => {
    if (data?.requirements?.length) {
      return data.requirements.map((requirement) => ({
        ...requirement,
        id: requirementId(requirement)
      }))
    }
    return [
      {
        id: 'completion',
        requirementNumber: 1,
        title: t('initiativeAgreement:submission.evidenceRequirement'),
        description: ''
      }
    ]
  }, [data?.requirements, t])
  useEffect(() => {
    if (data && (readOnly || !dirty.current)) {
      latest.current = evidenceResponsesFor(data, sections)
      setEvidenceResponses(latest.current)
    }
  }, [data, readOnly, sections])
  useEffect(() => {
    if (!data || !sections.length) return
    if (initializedAccordionForAction.current === String(designatedActionId))
      return
    initializedAccordionForAction.current = String(designatedActionId)
    setExpanded([sections[0].id])
  }, [data, designatedActionId, sections])
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
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current)
        autoSaveTimer.current = null
      }
      const snapshot = { ...latest.current }
      setSaving(true)
      setFailure('')
      const task = queue.current
        .catch(() => {})
        .then(async () => {
          const body = {
            evidenceResponses: snapshot,
            declarationAccepted: submit && declaration
          }
          const response = submit
            ? await api.post(`${url}/submit`, body)
            : await api.put(url, body)
          if (response.data?.evidenceResponses) {
            queryClient.setQueryData(queryKey, response.data)
          }
          if (JSON.stringify(latest.current) === JSON.stringify(snapshot)) {
            dirty.current = false
            latest.current = response.data?.evidenceResponses || snapshot
            setEvidenceResponses(latest.current)
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
  const cancelAutoSave = useCallback(() => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = null
    }
  }, [])
  useEffect(() => {
    if (locked || !dirty.current) return
    cancelAutoSave()
    autoSaveTimer.current = setTimeout(() => {
      autoSaveTimer.current = null
      save().catch(() => {})
    }, 1000)
    return cancelAutoSave
  }, [evidenceResponses, locked, save, cancelAutoSave])
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
  const change = (requirementKey, fieldKey, value) => {
    dirty.current = true
    latest.current = {
      ...latest.current,
      [requirementKey]: {
        ...EMPTY_RESPONSE,
        ...(latest.current[requirementKey] || {}),
        [fieldKey]: value
      }
    }
    setEvidenceResponses(latest.current)
    setMessage('Unsaved changes')
  }
  return (
    <EOCSubmissionPage
      data={data}
      designatedActionId={designatedActionId}
      serverData={serverData}
      sections={sections}
      evidenceResponses={evidenceResponses}
      expanded={expanded}
      setExpanded={setExpanded}
      onChange={change}
      onSave={save}
      onDownload={downloadSubmissionDocument}
      readOnly={readOnly}
      locked={locked}
      saving={saving}
      message={message}
      failure={failure}
      currentUser={currentUser}
      isSigner={hasRoles?.(roles.ia_signer)}
      declaration={declaration}
      onDeclarationChange={setDeclaration}
      uploadOpen={uploadOpen}
      onUploadOpen={setUploadOpen}
      onUploadClose={() => {
        setUploadOpen(false)
        queryClient.invalidateQueries({
          queryKey: [
            'document-tree',
            'designatedAction',
            String(designatedActionId)
          ]
        })
      }}
      blocker={blocker}
      dirty={dirty}
    />
  )
}
