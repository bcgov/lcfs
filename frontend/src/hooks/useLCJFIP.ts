import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaginationParams, QueryOptions } from './types'

// Low carbon jet fuel incentive program (LCJFIP) application API (#5532).

export type LCJFIPOption = { id: number; name: string }

export type LCJFIPIncentiveOption = LCJFIPOption & {
  incentiveType: 'Cash' | 'Credit'
  requiresFuelSupplier: boolean
}

export type LCJFIPIncentiveRate = {
  incentiveType: 'Cash' | 'Credit'
  ciLowerBound: number | null
  ciUpperBound: number | null
  maxRatePerLitre: number
  description: string | null
}

export type LCJFIPReferenceData = {
  carTypes: LCJFIPOption[]
  certificateTypes: LCJFIPOption[]
  feedstockSources: LCJFIPOption[]
  incentiveOptions: LCJFIPIncentiveOption[]
  incentiveRates: LCJFIPIncentiveRate[]
  maxPricePremiumRange: number
}

export type LCJFIPFuelCodeOption = {
  fuelCodeId: number
  fuelCode: string
  carbonIntensity: number
  company: string | null
}

export type LCJFIPPurchaseDetail = {
  lcjfipPurchaseDetailId?: number | null
  estimatedVolume: number | null
  anticipatedDeliveryDate: string | null
  feedstockSourceIds: number[]
  estimatedBlendPercentage: number | null
  assumedJetAPrice: number | null
  pricePremiumFrom: number | null
  pricePremiumTo: number | null
}

export type LCJFIPApplication = {
  lcjfipApplicationId: number
  applicationNumber: string
  status: string
  organization: {
    organizationId: number
    name: string | null
    operatingName: string | null
    email: string | null
    phone: string | null
    addressLine: string | null
  } | null
  contact: {
    userProfileId: number
    firstName: string | null
    lastName: string | null
    title: string | null
    email: string | null
    phone: string | null
  } | null
  carTypeIds: number[]
  certificateTypeId: number | null
  incentiveOptionId: number | null
  incentiveType: 'Cash' | 'Credit' | null
  estimatedCarbonIntensity: number | null
  fuelCode: LCJFIPFuelCodeOption | null
  requestedIncentiveVolume: number | null
  totalEstimatedVolume: number | null
  maxIncentiveRatePerLitre: number | null
  estimatedIncentiveAmount: number | null
  fuelSupplierOrganization: { organizationId: number; name: string } | null
  fuelSupplierLegalName: string | null
  fuelSupplierContactFirstName: string | null
  fuelSupplierContactLastName: string | null
  fuelSupplierContactEmail: string | null
  applicationPeriod: string | null
  signedBy: string | null
  signedDate: string | null
  purchaseDetails: (LCJFIPPurchaseDetail & { lcjfipPurchaseDetailId: number })[]
  createDate: string | null
  updateDate: string | null
}

/** One row of the applications index (#5541). */
export type LCJFIPApplicationListItem = {
  lcjfipApplicationId: number
  applicationNumber: string
  status: string
  organizationName: string | null
  contactName: string | null
  submittedDate: string | null
  incentiveType: 'Cash' | 'Credit' | null
  // Empty until the award (#5284) and disbursement (#5285, #5286) stories.
  incentiveAwardDate: string | null
  authorizedDisbursement: number | null
  updateDate: string | null
}

export type LCJFIPApplicationsPage = {
  applications: LCJFIPApplicationListItem[]
  pagination: {
    total: number
    page: number
    size: number
    totalPages: number
  }
}

export type LCJFIPApplicationPayload = {
  carTypeIds: number[]
  certificateTypeId: number | null
  incentiveOptionId: number | null
  estimatedCarbonIntensity: number | null
  fuelCodeId: number | null
  requestedIncentiveVolume: number | null
  fuelSupplierOrganizationId: number | null
  fuelSupplierLegalName: string | null
  fuelSupplierContactFirstName: string | null
  fuelSupplierContactLastName: string | null
  fuelSupplierContactEmail: string | null
  purchaseDetails: LCJFIPPurchaseDetail[]
}

export type LCJFIPDeclarations = {
  declarationAuthority: boolean
  declarationDocumentation: boolean
  declarationPublicRecognition: boolean
}

export const LCJFIP_QUERY_KEYS = {
  referenceData: ['lcjfip-reference-data'],
  fuelCodes: ['lcjfip-fuel-codes'],
  // The index pages share this prefix, so invalidating it refreshes all.
  list: ['lcjfip-applications'],
  page: (pagination: PaginationParams) => ['lcjfip-applications', pagination],
  statuses: ['lcjfip-statuses'],
  detail: (id: number | string) => ['lcjfip-application', String(id)]
}

const applicationUrl = (route: string, id: number | string) =>
  route.replace(':applicationId', String(id))

export const useLCJFIPReferenceData = (
  options: QueryOptions<LCJFIPReferenceData> = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: LCJFIP_QUERY_KEYS.referenceData,
    queryFn: async () =>
      (await client.get(apiRoutes.lcjfipReferenceData))
        .data as LCJFIPReferenceData,
    staleTime: 10 * 60 * 1000,
    ...options
  })
}

export const useLCJFIPFuelCodes = (
  options: QueryOptions<LCJFIPFuelCodeOption[]> = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: LCJFIP_QUERY_KEYS.fuelCodes,
    queryFn: async () =>
      (await client.get(apiRoutes.lcjfipFuelCodes))
        .data as LCJFIPFuelCodeOption[],
    staleTime: 10 * 60 * 1000,
    ...options
  })
}

/** A page of the applications index, filtered and sorted on the server. */
export const useLCJFIPApplications = (
  { page = 1, size = 10, sortOrders = [], filters = [] }: PaginationParams = {},
  options: QueryOptions<LCJFIPApplicationsPage> = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: LCJFIP_QUERY_KEYS.page({ page, size, sortOrders, filters }),
    queryFn: async () =>
      (
        await client.post(apiRoutes.lcjfipApplicationsList, {
          page,
          size,
          sortOrders,
          filters
        })
      ).data as LCJFIPApplicationsPage,
    ...options
  })
}

/**
 * Statuses for the index's status filter: the ones the user can see (no
 * Draft for government users), as { status } options.
 */
export const useLCJFIPStatuses = (
  options: QueryOptions<{ status: string }[]> = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: LCJFIP_QUERY_KEYS.statuses,
    queryFn: async () =>
      ((await client.get(apiRoutes.lcjfipStatuses)).data as string[]).map(
        (status) => ({ status })
      ),
    staleTime: 60 * 60 * 1000,
    ...options
  })
}

export const useLCJFIPApplication = (
  applicationId: number | string | undefined | null,
  options: QueryOptions<LCJFIPApplication> = {}
) => {
  const client = useApiService()
  return useQuery({
    enabled: !!applicationId,
    queryKey: LCJFIP_QUERY_KEYS.detail(applicationId ?? ''),
    queryFn: async () =>
      (
        await client.get(
          applicationUrl(apiRoutes.lcjfipApplication, applicationId ?? '')
        )
      ).data as LCJFIPApplication,
    // A returning applicant must see what was last saved.
    refetchOnMount: 'always',
    ...options
  })
}

/** Create the draft on its first save, or save an existing draft. */
export const useSaveLCJFIPApplication = () => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      applicationId,
      payload
    }: {
      applicationId?: number | string | null
      payload: LCJFIPApplicationPayload
    }) =>
      (applicationId
        ? await client.put(
            applicationUrl(apiRoutes.lcjfipApplication, applicationId),
            payload
          )
        : await client.post(apiRoutes.lcjfipApplications, payload)
      ).data as LCJFIPApplication,
    onSuccess: (data) => {
      queryClient.setQueryData(
        LCJFIP_QUERY_KEYS.detail(data.lcjfipApplicationId),
        data
      )
      queryClient.invalidateQueries({ queryKey: LCJFIP_QUERY_KEYS.list })
    }
  })
}

export const useSubmitLCJFIPApplication = () => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      applicationId,
      declarations
    }: {
      applicationId: number | string
      declarations: LCJFIPDeclarations
    }) =>
      (
        await client.post(
          applicationUrl(apiRoutes.submitLcjfipApplication, applicationId),
          declarations
        )
      ).data as LCJFIPApplication,
    onSuccess: (data) => {
      queryClient.setQueryData(
        LCJFIP_QUERY_KEYS.detail(data.lcjfipApplicationId),
        data
      )
      queryClient.invalidateQueries({ queryKey: LCJFIP_QUERY_KEYS.list })
    }
  })
}

export const useDeleteLCJFIPApplication = () => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (applicationId: number | string) => {
      await client.delete(
        applicationUrl(apiRoutes.lcjfipApplication, applicationId)
      )
      return applicationId
    },
    // The deleted application's own query is left to expire: removing it
    // while its page is still mounted would refetch it and 404.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LCJFIP_QUERY_KEYS.list })
    }
  })
}
