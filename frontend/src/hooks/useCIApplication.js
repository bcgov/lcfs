import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const QUERY_KEYS = {
  options: ['ci-application-options'],
  list: (pagination) => ['ci-applications', pagination],
  detail: (id) => ['ci-application', String(id)]
}

export const useCIApplicationOptions = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: QUERY_KEYS.options,
    queryFn: async () => (await client.get(apiRoutes.ciApplicationOptions)).data,
    staleTime: 60 * 60 * 1000, // 1 hour — lookup data
    gcTime: 60 * 60 * 1000,
    ...options
  })
}

export const useCIApplicationStatuses = (options) => {
  const query = useCIApplicationOptions({
    select: (data) => data?.statuses ?? [],
    ...options
  })
  return {
    ...query,
    data: query.data ?? []
  }
}

export const useGetCIApplications = (
  { page = 1, size = 10, sortOrders = [], filters = [] } = {},
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: QUERY_KEYS.list({ page, size, sortOrders, filters }),
    queryFn: async () => {
      return (
        await client.post(apiRoutes.getCIApplications, {
          page,
          size,
          sortOrders,
          filters
        })
      ).data
    },
    staleTime: 60 * 1000,
    ...options
  })
}

export const useGetCIApplication = (ciApplicationId, options) => {
  const client = useApiService()
  return useQuery({
    enabled: !!ciApplicationId,
    queryKey: QUERY_KEYS.detail(ciApplicationId),
    queryFn: async () => {
      return (
        await client.get(
          apiRoutes.getCIApplication.replace(
            ':ciApplicationId',
            ciApplicationId
          )
        )
      ).data
    },
    staleTime: 60 * 1000,
    ...options
  })
}

export const useCreateCIApplication = () => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      return (await client.post(apiRoutes.createCIApplication, payload)).data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ci-applications'] })
      if (data?.ciApplicationId) {
        queryClient.setQueryData(QUERY_KEYS.detail(data.ciApplicationId), data)
      }
    }
  })
}

export const useUpdateCIApplicationStep1 = (ciApplicationId) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      return (
        await client.put(
          apiRoutes.updateCIApplicationStep1.replace(
            ':ciApplicationId',
            ciApplicationId
          ),
          payload
        )
      ).data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ci-applications'] })
      queryClient.setQueryData(QUERY_KEYS.detail(ciApplicationId), data)
    }
  })
}

export const useUpdateCIApplicationStep2 = (ciApplicationId) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      return (
        await client.put(
          apiRoutes.updateCIApplicationStep2.replace(
            ':ciApplicationId',
            ciApplicationId
          ),
          payload
        )
      ).data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ci-applications'] })
      queryClient.setQueryData(QUERY_KEYS.detail(ciApplicationId), data)
    }
  })
}

export const useUpdateCIApplicationStep3 = (ciApplicationId) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      return (
        await client.put(
          apiRoutes.updateCIApplicationStep3.replace(
            ':ciApplicationId',
            ciApplicationId
          ),
          payload
        )
      ).data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ci-applications'] })
      queryClient.setQueryData(QUERY_KEYS.detail(ciApplicationId), data)
    }
  })
}

export const useSubmitCIApplication = (ciApplicationId) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      return (
        await client.post(
          apiRoutes.submitCIApplication.replace(
            ':ciApplicationId',
            ciApplicationId
          ),
          payload
        )
      ).data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ci-applications'] })
      queryClient.setQueryData(QUERY_KEYS.detail(ciApplicationId), data)
    }
  })
}

export const useRecordCIDecision = (ciApplicationId) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      return (
        await client.post(
          apiRoutes.ciApplicationDecision.replace(
            ':ciApplicationId',
            ciApplicationId
          ),
          payload
        )
      ).data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ci-applications'] })
      // The Step 5 comment thread is invalidated by the shared
      // <Comments /> widget itself when it posts. Nothing to do here.
      queryClient.setQueryData(QUERY_KEYS.detail(ciApplicationId), data)
    }
  })
}

// The Step 5 comment thread now uses the shared internal_comments
// framework — see <Comments entityType="ciApplication" /> in
// GovernmentDecisionStep. The legacy useGetCIComments / useAddCIComment
// hooks were removed when CI applications were migrated onto it.

export const useDeleteCIApplication = () => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ciApplicationId) => {
      return (
        await client.delete(
          apiRoutes.deleteCIApplication.replace(
            ':ciApplicationId',
            ciApplicationId
          )
        )
      ).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ci-applications'] })
    }
  })
}
