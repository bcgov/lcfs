export type GridErrors = Record<string | number, string[]>
export type GridWarnings = Record<string | number, string[]>

export interface FuelCategory {
  fuelCategory: string
  fuelCategoryId: number
  category?: string
  defaultAndPrescribedCi?: number
}

export interface FuelCode {
  fuelCode?: string
  fuel_code?: string
  fuelCodeId?: number
  fuel_code_id?: number
  carbonIntensity?: number
  fuelCodeCarbonIntensity?: number
  fuelCodeEffectiveDate?: string
  fuelCodeExpirationDate?: string
  fuelProductionFacilityCountry?: string
}

export interface EerRatio {
  fuelCategory: { fuelCategory: string }
  endUseType: { type: string; endUseTypeId: number } | null
  energyEffectivenessRatio: number
}

export interface TargetCarbonIntensity {
  fuelCategory: { fuelCategory: string }
  targetCarbonIntensity: number
}

export interface Provision {
  name: string
  provisionOfTheActId: number
}

export interface FuelType {
  fuelType: string
  fuelTypeId: number
  unit: string
  defaultCarbonIntensity: number
  unrecognized?: boolean
  fossilDerived?: boolean
  fuelCategories: FuelCategory[]
  fuelCodes: FuelCode[]
  provisions: Provision[]
  provisionOfTheAct?: Provision[]
  eerRatios: EerRatio[]
  targetCarbonIntensities?: TargetCarbonIntensity[]
}

export interface FuelCodePrefix {
  prefix: string
  fuelCodePrefixId: number
  nextFuelCode?: string
  fuelCodePrefix?: string
}

export interface TransportMode {
  transportMode: string
}

export interface OptionsData {
  fuelTypes: FuelType[]
  fuelCategories?: Array<{ category: string; fuelCategoryId?: number }>
  receivedOrTransferred?: string[]
  expectedUses?: Array<{ name: string }>
  organizationNames?: string[]
  levelsOfEquipment?: Array<{ name: string }>
  ports?: string[]
  intendedUseTypes?: Array<{ type: string }>
  intendedUserTypes?: Array<{ typeName: string }>
  fuelCodePrefixes?: FuelCodePrefix[]
  transportModes?: TransportMode[]
  facilityNameplateCapacityUnits?: string[]
  fieldOptions?: {
    feedstock: string[]
    feedstockLocation: string[]
    feedstockMisc: string[]
    formerCompany: string[]
  }
}

export interface CompareReportColumn {
  id: string
  label: string
  align?: string
  width?: string
  maxWidth?: string
  bold?: boolean
}

export interface SummaryColumn {
  id: string
  label: string
  align?: string
  width?: string
  maxWidth?: string
  bold?: boolean
  editable?: boolean
  editableCells?: (string | number)[]
  cellConstraints?: Record<string | number, { min: number; max?: number }>
}
