import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useAllocationAgreementOptions = (params, options) => {
  const client = useApiService()
  const path =
    apiRoutes.allocationAgreementOptions +
    'compliancePeriod=' +
    params.compliancePeriod
  return useQuery({
    queryKey: ['allocation-agreement-options'],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}

export const useGetAllocationAgreements = (
  complianceReportId,
  pagination,
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['allocation-agreements', complianceReportId, pagination],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllocationAgreements, {
        complianceReportId,
        ...pagination
      })
      return response.data
    },
    ...options
  })
}

export const useGetAllAllocationAgreements = (
  complianceReportId,
  pagination,
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['allocation-agreements', complianceReportId, pagination],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllAllocationAgreements, {
        complianceReportId,
        ...pagination
      })
      return response.data
    },
    ...options
  })
}

export const useGetAllocationAgreementsList = (
  { complianceReportId, changelog = false },
  pagination,
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['allocation-agreements', complianceReportId, changelog],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllAllocationAgreements, {
        complianceReportId,
        changelog,
        ...pagination
      })
      return response.data
    },
    ...options
  })
}

export const useSaveAllocationAgreement = (params, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      const modifiedData = {
        complianceReportId: params.complianceReportId,
        ...data
      }
      return await client.post(apiRoutes.saveAllocationAgreements, modifiedData)
    },
    onSettled: () => {
      queryClient.invalidateQueries([
        'allocation-agreements',
        params.complianceReportId
      ])
      queryClient.invalidateQueries([
        'compliance-report-summary',
        params.complianceReportId
      ])
    }
  })
}

export const useImportAllocationAgreement = (complianceReportId, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.importAllocationAgreements.replace(
    ':reportID',
    complianceReportId
  )

  return useMutation({
    ...options,
    mutationFn: async ({ file, isOverwrite }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', file.name)
      formData.append('overwrite', isOverwrite)

      return await client.post(path, formData, {
        accept: 'application/json',
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries([
        'allocation-agreements',
        complianceReportId
      ])
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'allocation-agreements' &&
            query.queryKey[1] === complianceReportId
          )
        }
      })
      if (options.onSuccess) {
        options.onSuccess(data)
      }
    }
  })
}

export const useGetAllocationAgreementImportJobStatus = (jobID, options) => {
  const client = useApiService()
  return useQuery({
    queryFn: async () => {
      const response = await client.get(
        apiRoutes.getImportAllocationAgreementsJobStatus.replace(
          ':jobID',
          jobID
        )
      )
      return response.data
    },
    queryKey: ['importJob', jobID],
    staleTime: 0,
    enabled: !!jobID,
    ...options
  })
}
