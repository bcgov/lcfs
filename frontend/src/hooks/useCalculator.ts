import { LEGISLATION_TRANSITION_YEAR } from '@/constants/common'
import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import type { QueryOptions } from './types'
import type { AxiosResponse } from 'axios'

interface CalculatorPeriod {
  compliancePeriodId: number
  description: string
}

interface CalculatorFuelType {
  fuelTypeId: number
  fuelType: string
  fuelCategoryId?: number
}

interface CalculatorFuelTypeOptions {
  unit?: string
  energyDensity?: { unit?: { name?: string } }
  provisions?: Array<{ name: string }>
  eerRatios?: Array<{
    endUseType?: { type: string; endUseTypeId: number } | null
  }>
  fuelCodes?: Array<{ fuelCode: string; fuelCodeId: number }>
}

export interface CalculatorResult {
  complianceUnits?: number
  quantity?: number
  energyContent?: number
  tci?: number | null
  eer?: number | null
  rci?: number | null
  uci?: number | null
  energyDensity?: number | null
}

export const useGetCompliancePeriodList = (
  options: QueryOptions<AxiosResponse<CalculatorPeriod[]>> = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['calculator-compliance-periods'],
    queryFn: () =>
      client.get<CalculatorPeriod[]>(apiRoutes.getCalculatorCompliancePeriods),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: 10 * 60 * 1000,
    ...options
  })
}

export const useGetFuelTypeList = (params: Record<string, unknown>) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['calculator-fuel-types', params],
    queryFn: () =>
      client.get<CalculatorFuelType[]>(
        apiRoutes.getCalculatorFuelTypes.replace(
          ':complianceYear',
          params.complianceYear as string
        ),
        {
          params: {
            fuel_category: params.fuelCategory,
            lcfs_only: params.lcfsOnly
          }
        }
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!params.fuelCategory && !!(params.fuelCategory !== '')
  })
}

export const useGetFuelTypeOptions = (params: Record<string, unknown>) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['calculator-fuel-type-options', params],
    queryFn: () =>
      client.get<CalculatorFuelTypeOptions>(
        apiRoutes.getCalculatorFuelTypeOptions.replace(
          ':complianceYear',
          params.complianceYear as string
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
  useCustomCi = false,
  customCiValue,
  enabled = true
}: {
  compliancePeriod: string | number
  fuelCategoryId?: string | number
  fuelTypeId?: string | number
  endUseId?: string | number | null
  quantity: number | null
  fuelCodeId?: string | number | null
  useCustomCi?: boolean
  customCiValue?: string | number | null
  enabled?: boolean
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
      fuelCodeId,
      useCustomCi,
      customCiValue
    ],
    queryFn: () =>
      client.get<CalculatorResult>(
        apiRoutes.getCalculatedComplianceUnits.replace(
          ':complianceYear',
          compliancePeriod as string
        ),
        {
          params: {
            fuelCategoryId,
            fuelTypeId,
            endUseId,
            quantity,
            fuelCodeId,
            useCustomCi,
            ...(customCiValue !== undefined && { customCiValue })
          }
        }
      ),
    staleTime: 5 * 60 * 1000,
    enabled:
      enabled &&
      !!compliancePeriod &&
      !!fuelCategoryId &&
      !!fuelTypeId &&
      !!(
        endUseId ||
        parseInt(compliancePeriod as string) >= LEGISLATION_TRANSITION_YEAR
      ) &&
      !!quantity
  })
}

export const useCalculateQuantityFromComplianceUnits = ({
  compliancePeriod,
  fuelCategoryId,
  fuelTypeId,
  endUseId,
  complianceUnits,
  fuelCodeId,
  useCustomCi = false,
  customCiValue,
  enabled = true
}: {
  compliancePeriod: string | number
  fuelCategoryId?: string | number
  fuelTypeId?: string | number
  endUseId?: string | number | null
  complianceUnits: number
  fuelCodeId?: string | number | null
  useCustomCi?: boolean
  customCiValue?: string | number | null
  enabled?: boolean
}) => {
  const client = useApiService()
  return useQuery({
    queryKey: [
      'calculatedQuantity',
      compliancePeriod,
      fuelCategoryId,
      fuelTypeId,
      endUseId,
      complianceUnits,
      fuelCodeId,
      useCustomCi,
      customCiValue
    ],
    queryFn: () =>
      client.get<CalculatorResult>(
        apiRoutes.getCalculatorQuantityFromComplianceUnits.replace(
          ':complianceYear',
          compliancePeriod as string
        ),
        {
          params: {
            fuelCategoryId,
            fuelTypeId,
            endUseId,
            complianceUnits,
            fuelCodeId,
            useCustomCi,
            ...(customCiValue !== undefined && { customCiValue })
          }
        }
      ),
    staleTime: 5 * 60 * 1000,
    enabled:
      enabled &&
      !!compliancePeriod &&
      !!fuelCategoryId &&
      !!fuelTypeId &&
      !!(
        endUseId ||
        parseInt(compliancePeriod as string) >= LEGISLATION_TRANSITION_YEAR
      ) &&
      !!complianceUnits
  })
}

export const useGetLookupTableData = (
  complianceYear: string | number | undefined,
  options: QueryOptions<unknown>
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['lookup-table-data', complianceYear],
    queryFn: () =>
      client.get(
        apiRoutes.getLookupTableData.replace(
          ':complianceYear',
          String(complianceYear ?? '')
        )
      ),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 60 * 60 * 1000,
    enabled: !!complianceYear,
    ...options
  })
}
