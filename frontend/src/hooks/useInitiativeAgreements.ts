import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import type { ApiServiceInstance } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaginationParams, QueryOptions } from './types'

// Agreement-management hooks for the Initiative Agreements module.
// The legacy singular useInitiativeAgreement.ts serves the outgoing
// credit-award transaction flow and is retired at the transaction-flow
// cutover.

const QUERY_KEYS = {
  list: (pagination: unknown) => ['initiative-agreements', pagination],
  detail: (id: unknown) => ['initiative-agreements', 'detail', String(id)],
  statuses: ['initiative-agreement-statuses'],
  designatedActions: (agreementId: unknown, pagination: unknown) => [
    'designated-actions',
    String(agreementId),
    pagination
  ],
  analysts: ['initiative-agreement-analysts']
}

export const useGetInitiativeAgreements = (
  { page = 1, size = 10, sortOrders = [], filters = [] }: PaginationParams = {},
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: QUERY_KEYS.list({ page, size, sortOrders, filters }),
    queryFn: async () =>
      (
        await client.post(apiRoutes.getInitiativeAgreementsList, {
          page,
          size,
          sortOrders,
          filters
        })
      ).data,
    staleTime: 60 * 1000,
    ...options
  })
}

export const useGetInitiativeAgreement = (
  initiativeAgreementId: number | string,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    enabled: !!initiativeAgreementId,
    queryKey: QUERY_KEYS.detail(initiativeAgreementId),
    queryFn: async () =>
      (
        await client.get(
          apiRoutes.getInitiativeAgreement.replace(
            ':initiativeAgreementId',
            String(initiativeAgreementId)
          )
        )
      ).data,
    staleTime: 60 * 1000,
    ...options
  })
}

export const useInitiativeAgreementDocumentRestoreTargets = (
  initiativeAgreementId: number | string,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    enabled: !!initiativeAgreementId,
    queryKey: [
      'initiative-agreements',
      'document-restore-targets',
      String(initiativeAgreementId)
    ],
    queryFn: async () =>
      (
        await client.get(
          apiRoutes.getInitiativeAgreementDocumentRestoreTargets.replace(
            ':initiativeAgreementId',
            String(initiativeAgreementId)
          )
        )
      ).data,
    ...options
  })
}

/** Lifecycle statuses for the index grid's status filter. */
export const useInitiativeAgreementStatuses = (
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: QUERY_KEYS.statuses,
    queryFn: async () =>
      (await client.get(apiRoutes.getInitiativeAgreementStatuses)).data,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    ...options
  })
}

/** Paginated designated actions for one agreement's grid (#4896). */
/** Every agreement's designated actions, for the module's tab (#5078). */
export const useAllDesignatedActions = (
  { page = 1, size = 10, sortOrders = [], filters = [] }: PaginationParams = {},
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: [
      'designated-actions',
      'all',
      { page, size, sortOrders, filters }
    ],
    queryFn: async () =>
      (
        await client.post(apiRoutes.getAllDesignatedActionsList, {
          page,
          size,
          sortOrders,
          filters
        })
      ).data,
    ...options
  })
}

export const useDesignatedActions = (
  initiativeAgreementId: number | string,
  { page = 1, size = 10, sortOrders = [], filters = [] }: PaginationParams = {},
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    enabled: !!initiativeAgreementId,
    queryKey: QUERY_KEYS.designatedActions(initiativeAgreementId, {
      page,
      size,
      sortOrders,
      filters
    }),
    queryFn: async () =>
      (
        await client.post(
          apiRoutes.getDesignatedActionsList.replace(
            ':initiativeAgreementId',
            String(initiativeAgreementId)
          ),
          { page, size, sortOrders, filters }
        )
      ).data,
    ...options
  })
}

/** The designated action detail page's record (#4840). */
export const useDesignatedActionProfile = (
  designatedActionId: number | string,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    enabled: !!designatedActionId,
    queryKey: ['designated-actions', 'detail', String(designatedActionId)],
    queryFn: async () =>
      (
        await client.get(
          apiRoutes.getDesignatedActionProfile.replace(
            ':designatedActionId',
            String(designatedActionId)
          )
        )
      ).data,
    ...options
  })
}

/** Active IA analysts for the assignment dropdown and its filter. */
export const useInitiativeAgreementAnalysts = (
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: QUERY_KEYS.analysts,
    queryFn: async () =>
      (await client.get(apiRoutes.getInitiativeAgreementAnalysts)).data,
    staleTime: 5 * 60 * 1000,
    ...options
  })
}

/** Assign, reassign or unassign the analyst on a designated action. */
export const useAssignDesignatedActionAnalyst = (
  designatedActionId: number | string
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (assignedAnalystId: number | null) =>
      (
        await client.put(
          apiRoutes.assignDesignatedActionAnalyst.replace(
            ':designatedActionId',
            String(designatedActionId)
          ),
          { assignedAnalystId }
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designated-actions'] })
    }
  })
}

/** Evidence of completion requirements for a designated action (#4899). */
const evidenceKey = (designatedActionId: number | string) => [
  'evidence-requirements',
  String(designatedActionId)
]

export const useEvidenceRequirements = (
  designatedActionId: number | string,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    enabled: !!designatedActionId,
    queryKey: evidenceKey(designatedActionId),
    queryFn: async () =>
      (
        await client.get(
          apiRoutes.evidenceRequirements.replace(
            ':designatedActionId',
            String(designatedActionId)
          )
        )
      ).data,
    ...options
  })
}

const useEvidenceMutation = <TVariables>(
  designatedActionId: number | string,
  mutationFn: (
    client: ApiServiceInstance
  ) => (variables: TVariables) => Promise<unknown>
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: mutationFn(client),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: evidenceKey(designatedActionId)
      })
  })
}

export const useCreateEvidenceRequirement = (
  designatedActionId: number | string
) =>
  useEvidenceMutation(
    designatedActionId,
    (client) => async (payload: { title: string; description: string }) =>
      (
        await client.post(
          apiRoutes.evidenceRequirements.replace(
            ':designatedActionId',
            String(designatedActionId)
          ),
          payload
        )
      ).data
  )

export const useUpdateEvidenceRequirement = (
  designatedActionId: number | string
) =>
  useEvidenceMutation(
    designatedActionId,
    (client) =>
      async ({
        evidenceRequirementId,
        ...payload
      }: {
        evidenceRequirementId: number
        [key: string]: unknown
      }) =>
        (
          await client.put(
            apiRoutes.evidenceRequirement.replace(
              ':evidenceRequirementId',
              String(evidenceRequirementId)
            ),
            payload
          )
        ).data
  )

export const useDeleteEvidenceRequirement = (
  designatedActionId: number | string
) =>
  useEvidenceMutation(
    designatedActionId,
    (client) => async (evidenceRequirementId: number) =>
      client.delete(
        apiRoutes.evidenceRequirement.replace(
          ':evidenceRequirementId',
          String(evidenceRequirementId)
        )
      )
  )

/** Designated action workflow transitions and audit trail (#4898). */
const actionPath = (template: string, designatedActionId: number | string) =>
  template.replace(':designatedActionId', String(designatedActionId))

export const useDesignatedActionWorkflow = (
  designatedActionId: number | string
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      action: string
      comment?: string
      recommendedCredits?: number | null
    }) =>
      (
        await client.put(
          actionPath(apiRoutes.designatedActionWorkflow, designatedActionId),
          payload
        )
      ).data,
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: ['designated-actions'] })
      queryClient.invalidateQueries({
        queryKey: ['designated-action-history', String(designatedActionId)]
      })
      if (payload.action === 'approve') {
        for (const key of [
          'initiative-agreements',
          'transactions-list',
          'credit-ledger',
          'period-credit-ledger',
          'credit-ledger-years',
          'organization',
          'organization-balance',
          'current-org-balance',
          'transaction-counts',
          'org-transaction-counts'
        ]) {
          queryClient.invalidateQueries({ queryKey: [key] })
        }
      }
    }
  })
}

export const useSetRecommendedCredits = (
  designatedActionId: number | string
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (recommendedCredits: number | null) =>
      (
        await client.put(
          actionPath(
            apiRoutes.designatedActionRecommendedCredits,
            designatedActionId
          ),
          { recommendedCredits }
        )
      ).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['designated-actions'] })
  })
}

export const useDesignatedActionHistory = (
  designatedActionId: number | string,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    enabled: !!designatedActionId,
    queryKey: ['designated-action-history', String(designatedActionId)],
    queryFn: async () =>
      (
        await client.get(
          actionPath(apiRoutes.designatedActionHistory, designatedActionId)
        )
      ).data,
    ...options
  })
}

/** Add a designated action to a draft or underway agreement (analysts and
 * managers). */
export const useCreateDesignatedAction = (
  initiativeAgreementId: number | string
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      creditAllocation?: number | null
      specifiedDate?: string | null
    }) =>
      (
        await client.post(
          apiRoutes.createDesignatedAction.replace(
            ':initiativeAgreementId',
            String(initiativeAgreementId)
          ),
          payload
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designated-actions'] })
      queryClient.invalidateQueries({ queryKey: ['initiative-agreements'] })
    }
  })
}

/** Correct a designated action's details (analysts and managers). */
export const useUpdateDesignatedAction = (
  designatedActionId: number | string
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name?: string
      creditAllocation?: number | null
      specifiedDate?: string | null
      clearSpecifiedDate?: boolean
    }) =>
      (
        await client.put(
          apiRoutes.updateDesignatedAction.replace(
            ':designatedActionId',
            String(designatedActionId)
          ),
          payload
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designated-actions'] })
      queryClient.invalidateQueries({
        queryKey: ['designated-action-history', String(designatedActionId)]
      })
    }
  })
}

export const useUpdateAgreement = (initiativeAgreementId: number | string) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      organizationId?: number | null
      iaCode?: string
      agreementType?: string
      title?: string | null
      projectDescription?: string | null
      projectLocation?: string | null
      contactName?: string | null
      contactEmail?: string | null
      contactPhone?: string | null
      agreementStartDate?: string | null
      agreementEndDate?: string | null
    }) =>
      (
        await client.put(
          apiRoutes.updateAgreement.replace(
            ':initiativeAgreementId',
            String(initiativeAgreementId)
          ),
          payload
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initiative-agreements'] })
    }
  })
}

/** Start a new initiative agreement (analysts and managers). It starts
 * Underway, and the organization may be left unset (#5186). */
export const useCreateAgreement = () => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      organizationId?: number | null
      iaCode: string
      agreementType?: string
      title?: string | null
      projectDescription?: string | null
      projectLocation?: string | null
      contactName?: string | null
      contactEmail?: string | null
      contactPhone?: string | null
      agreementStartDate?: string | null
      agreementEndDate?: string | null
    }) => (await client.post(apiRoutes.createAgreement, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initiative-agreements'] })
    }
  })
}

/** Notes recorded against an initiative agreement (#5486). */
export interface InitiativeAgreementNote {
  initiativeAgreementNoteId: number
  initiativeAgreementId: number
  noteNumber: number
  noteText: string
  lastEditedBy?: {
    userProfileId: number
    firstName?: string | null
    lastName?: string | null
  } | null
  lastEditedDate: string | null
}

const notesKey = (initiativeAgreementId: number | string) => [
  'initiative-agreement-notes',
  String(initiativeAgreementId)
]

const notesPath = (template: string, initiativeAgreementId: number | string) =>
  template.replace(':initiativeAgreementId', String(initiativeAgreementId))

export const useInitiativeAgreementNotes = (
  initiativeAgreementId: number | string,
  options: QueryOptions<InitiativeAgreementNote[]> = {}
) => {
  const client = useApiService()
  return useQuery<InitiativeAgreementNote[]>({
    enabled: !!initiativeAgreementId,
    queryKey: notesKey(initiativeAgreementId),
    queryFn: async () =>
      (
        await client.get(
          notesPath(apiRoutes.initiativeAgreementNotes, initiativeAgreementId)
        )
      ).data,
    ...options
  })
}

/** The number the add-note form starts from; refreshed with every save. */
export const useNextNoteNumber = (
  initiativeAgreementId: number | string,
  options: QueryOptions<number> = {}
) => {
  const client = useApiService()
  return useQuery<number>({
    queryKey: [...notesKey(initiativeAgreementId), 'next-number'],
    queryFn: async () =>
      (
        await client.get(
          notesPath(
            apiRoutes.initiativeAgreementNextNoteNumber,
            initiativeAgreementId
          )
        )
      ).data,
    ...options
  })
}

const useNoteMutation = <TVariables>(
  initiativeAgreementId: number | string,
  mutationFn: (
    client: ApiServiceInstance
  ) => (variables: TVariables) => Promise<unknown>
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: mutationFn(client),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: notesKey(initiativeAgreementId)
      })
  })
}

export const useCreateNote = (initiativeAgreementId: number | string) =>
  useNoteMutation(
    initiativeAgreementId,
    (client) => async (payload: { noteNumber?: number; noteText: string }) =>
      (
        await client.post(
          notesPath(apiRoutes.initiativeAgreementNotes, initiativeAgreementId),
          payload
        )
      ).data
  )

export const useUpdateNote = (initiativeAgreementId: number | string) =>
  useNoteMutation(
    initiativeAgreementId,
    (client) =>
      async ({
        noteId,
        ...payload
      }: {
        noteId: number
        noteNumber: number
        noteText: string
      }) =>
        (
          await client.put(
            notesPath(
              apiRoutes.initiativeAgreementNote,
              initiativeAgreementId
            ).replace(':noteId', String(noteId)),
            payload
          )
        ).data
  )

export const useDeleteNote = (initiativeAgreementId: number | string) =>
  useNoteMutation(
    initiativeAgreementId,
    (client) => async (noteId: number) =>
      client.delete(
        notesPath(
          apiRoutes.initiativeAgreementNote,
          initiativeAgreementId
        ).replace(':noteId', String(noteId))
      )
  )

/**
 * The DA/EOC submission page's data, shared by the BCeID page, the IDIR
 * read-only view and the IDIR EOC cards (#5516, #5545).
 */
export const eocKey = (designatedActionId: number | string) => [
  'designated-action-eoc',
  String(designatedActionId)
]

export const useDesignatedActionEoc = (
  designatedActionId: number | string,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    enabled: !!designatedActionId,
    queryKey: eocKey(designatedActionId),
    queryFn: async () =>
      (
        await client.get(
          actionPath(apiRoutes.designatedActionEoc, designatedActionId)
        )
      ).data,
    ...options
  })
}

const requestPath = (
  template: string,
  designatedActionId: number | string,
  ids: Record<string, number | string>
) =>
  Object.entries(ids).reduce(
    (path, [key, value]) => path.replace(`:${key}`, String(value)),
    actionPath(template, designatedActionId)
  )

/**
 * Requests for additional information on one EOC (#5545). Each mutation that
 * returns the EOC page's data puts it straight into the shared cache; the
 * evidence cards and the document tree refetch.
 */
const useEocInformationMutation = <TVariables>(
  designatedActionId: number | string,
  mutationFn: (
    client: ApiServiceInstance
  ) => (variables: TVariables) => Promise<unknown>
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: mutationFn(client),
    onSuccess: (data: unknown) => {
      if (
        data &&
        typeof data === 'object' &&
        'designatedActionId' in (data as Record<string, unknown>)
      ) {
        queryClient.setQueryData(eocKey(designatedActionId), data)
      } else {
        queryClient.invalidateQueries({ queryKey: eocKey(designatedActionId) })
      }
      queryClient.invalidateQueries({
        queryKey: evidenceKey(designatedActionId)
      })
      queryClient.invalidateQueries({
        queryKey: [
          'document-tree',
          'designatedAction',
          String(designatedActionId)
        ]
      })
    }
  })
}

export const useRequestEocInformation = (designatedActionId: number | string) =>
  useEocInformationMutation(
    designatedActionId,
    (client) =>
      async ({
        evidenceRequirementId,
        missingInformation
      }: {
        evidenceRequirementId: number
        missingInformation?: string
      }) =>
        (
          await client.post(
            requestPath(apiRoutes.eocInformationRequests, designatedActionId, {
              evidenceRequirementId
            }),
            missingInformation === undefined ? {} : { missingInformation }
          )
        ).data
  )

type EocResponse = {
  summaryOfWorkCompleted: string
  howEvidenceMeetsAgreementRequirements: string
  exceptionsLimitationsAndContext: string
}

export const useSaveEocInformationResponse = (
  designatedActionId: number | string
) =>
  useEocInformationMutation(
    designatedActionId,
    (client) =>
      async ({
        requestId,
        response
      }: {
        requestId: number
        response: EocResponse
      }) =>
        (
          await client.put(
            requestPath(apiRoutes.eocInformationRequest, designatedActionId, {
              requestId
            }),
            response
          )
        ).data
  )

export const useSubmitEocInformationResponse = (
  designatedActionId: number | string
) =>
  useEocInformationMutation(
    designatedActionId,
    (client) =>
      async ({
        requestId,
        response
      }: {
        requestId: number
        response: EocResponse
      }) =>
        (
          await client.post(
            requestPath(
              apiRoutes.eocInformationRequestSubmit,
              designatedActionId,
              {
                requestId
              }
            ),
            response
          )
        ).data
  )

export const useUploadEocInformationDocument = (
  designatedActionId: number | string
) =>
  useEocInformationMutation(
    designatedActionId,
    (client) =>
      async ({ requestId, file }: { requestId: number; file: File }) => {
        const formData = new FormData()
        formData.append('file', file)
        return (
          await client.post(
            requestPath(
              apiRoutes.eocInformationRequestDocuments,
              designatedActionId,
              { requestId }
            ),
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          )
        ).data
      }
  )

export const useRenameEocInformationDocument = (
  designatedActionId: number | string
) =>
  useEocInformationMutation(
    designatedActionId,
    (client) =>
      async ({
        requestId,
        documentId,
        displayName
      }: {
        requestId: number
        documentId: number
        displayName: string
      }) =>
        (
          await client.put(
            requestPath(
              apiRoutes.eocInformationRequestDocument,
              designatedActionId,
              { requestId, documentId }
            ),
            { displayName }
          )
        ).data
  )

export const useDeleteEocInformationDocument = (
  designatedActionId: number | string
) =>
  useEocInformationMutation(
    designatedActionId,
    (client) =>
      async ({
        requestId,
        documentId
      }: {
        requestId: number
        documentId: number
      }) =>
        (
          await client.delete(
            requestPath(
              apiRoutes.eocInformationRequestDocument,
              designatedActionId,
              { requestId, documentId }
            )
          )
        ).data
  )
