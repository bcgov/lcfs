import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaginationParams, QueryOptions } from './types'

// Agreement-management hooks for the Initiative Agreements module.
// The legacy singular useInitiativeAgreement.ts serves the outgoing
// credit-award transaction flow and is retired at the transaction-flow
// cutover.

const QUERY_KEYS = {
  list: (pagination: any) => ['initiative-agreements', pagination],
  detail: (id: any) => ['initiative-agreements', 'detail', String(id)],
  statuses: ['initiative-agreement-statuses'],
  designatedActions: (agreementId: any, pagination: any) => [
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

const useEvidenceMutation = (
  designatedActionId: number | string,
  mutationFn: (client: any) => (variables: any) => Promise<unknown>
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
    (client) => async (payload: { description: string }) =>
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designated-actions'] })
      queryClient.invalidateQueries({
        queryKey: ['designated-action-history', String(designatedActionId)]
      })
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

/** Add a designated action to a draft agreement (analysts and managers). */
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

/** Start a new initiative agreement as a draft (analysts and managers). */
export const useCreateAgreement = () => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      organizationId: number
      iaCode: string
      agreementType?: string
      title?: string | null
      projectDescription?: string | null
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
