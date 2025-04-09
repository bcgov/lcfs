import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'

export const useGetCompliancePeriodList = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['calculator-compliance-periods'],
    queryFn: () => client.get(apiRoutes.getCalculatorCompliancePeriods),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: 10 * 60 * 1000, // 10 minutes (optional)
    ...options
  })
}

export const useGetFuelTypeList = (params) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['calculator-fuel-types', params],
    queryFn: () =>
      client.get(
        apiRoutes.getCalculatorFuelTypes.replace(
          ':complianceYear',
          params.complianceYear
        ),
        {
          params: {
            fuel_category: params.fuelCategory,
            lcfs_only: params.lcfsOnly
          }
        }
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!params.fuelCategory && !!(params.fuelCategory !== '') // only fetch if fuel_category is provided
  })
}

export const useGetFuelTypeOptions = (params) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['calculator-fuel-type-options', params],
    queryFn: () =>
      client.get(
        apiRoutes.getCalculatorFuelTypeOptions.replace(
          ':complianceYear',
          params.complianceYear
        ),
        {
          params: {
            fuel_type_id: params.fuelTypeId,
            fuel_category_id: params.fuelCategoryId,
            lcfs_only: params.lcfsOnly
          }
        }
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!params.fuelTypeId && !!(params.fuelTypeId !== '')
  })
}

export const useCalculateComplianceUnits = ({
  compliancePeriod,
  fuelCategoryId,
  fuelTypeId,
  endUseId,
  quantity,
  fuelCodeId,
  enabled = true
}) => {
  const client = useApiService()
  return useQuery({
    queryKey: [
      'calculatedData',
      compliancePeriod,
      fuelCategoryId,
      fuelTypeId,
      endUseId,
      quantity,
      fuelCodeId
    ],
    queryFn: () =>
      client.get(
        apiRoutes.getCalculatedComplianceUnits.replace(
          ':complianceYear',
          compliancePeriod
        ),
        {
          params: {
            fuelCategoryId,
            fuelTypeId,
            endUseId,
            quantity,
            fuelCodeId
          }
        }
      ),
    staleTime: 5 * 60 * 1000,
    enabled:
      enabled &&
      !!compliancePeriod &&
      !!fuelCategoryId &&
      !!fuelTypeId &&
      !!endUseId &&
      !!quantity
  })
}
