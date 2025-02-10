import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useFinalSupplyEquipmentOptions = (options) => {
  const client = useApiService()
  const path = apiRoutes.finalSupplyEquipmentOptions
  return useQuery({
    queryKey: ['final-supply-equipment-options'],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}

export const useGetFinalSupplyEquipments = (
  complianceReportId,
  pagination,
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: [`final-supply-equipments ${complianceReportId} ${pagination}`],
    queryFn: async () => {
      const response = await client.post(
        apiRoutes.getAllFinalSupplyEquipments,
        { complianceReportId, ...pagination }
      )
      return response.data
    },
    ...options
  })
}

export const useSaveFinalSupplyEquipment = (complianceReportId, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      const modifedData = {
        ...data,
        levelOfEquipment: data.levelOfEquipment?.name || data.levelOfEquipment,
        complianceReportId
      }
      return await client.post(apiRoutes.saveFinalSupplyEquipments, modifedData)
    },
    onSettled: () => {
      queryClient.invalidateQueries([
        'final-supply-equipments',
        complianceReportId
      ])
      queryClient.invalidateQueries([
        'compliance-report-summary',
        complianceReportId
      ])
    }
  })
}

export const useImportFinalSupplyEquipment = (complianceReportId, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.importFinalSupplyEquipments.replace(
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
        'final-supply-equipments',
        complianceReportId
      ])
      if (options.onSuccess) {
        options.onSuccess(data)
      }
    }
  })
}

export const useGetFinalSupplyEquipmentImportJobStatus = (jobID, options) => {
  const client = useApiService()
  return useQuery({
    queryFn: async () => {
      const response = await client.get(
        apiRoutes.getImportFinalSupplyEquipmentsJobStatus.replace(
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
