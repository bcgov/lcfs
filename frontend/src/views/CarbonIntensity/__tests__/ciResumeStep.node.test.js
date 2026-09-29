import { describe, expect, it } from 'vitest'

import {
  CI_STEP_APPLICATION_INFO,
  CI_STEP_DOCUMENTS,
  CI_STEP_PROPOSED_PATHWAYS,
  CI_STEP_SIGN_SUBMIT,
  getCIResumeStep,
  isCIStep1Complete,
  isCIStep2Complete,
  isCIStep3Complete
} from '@/views/CarbonIntensity/ciResumeStep'

const step1Fields = {
  facilityCity: 'Vancouver',
  facilityProvinceState: 'BC',
  facilityCountry: 'Canada',
  facilityNameplateCapacity: 1000,
  facilityNameplateCapacityUnit: 'L'
}

const pathways = [{ pathwayId: 1 }]

const requiredDocuments = [
  { documentId: 1, documentCategory: 'technical_report' },
  { documentId: 2, documentCategory: 'ghgenius_model' }
]

describe('isCIStep1Complete', () => {
  it('is false when required facility fields are missing', () => {
    expect(isCIStep1Complete(null)).toBe(false)
    expect(isCIStep1Complete({})).toBe(false)
    expect(isCIStep1Complete({ ...step1Fields, facilityCity: '' })).toBe(false)
    expect(
      isCIStep1Complete({ ...step1Fields, facilityProvinceState: '' })
    ).toBe(false)
    expect(
      isCIStep1Complete({ ...step1Fields, facilityCountry: '' })
    ).toBe(false)
    expect(
      isCIStep1Complete({ ...step1Fields, facilityNameplateCapacity: 0 })
    ).toBe(false)
    expect(
      isCIStep1Complete({ ...step1Fields, facilityNameplateCapacityUnit: '' })
    ).toBe(false)
  })

  it('is true when location, positive capacity and unit are saved', () => {
    expect(isCIStep1Complete(step1Fields)).toBe(true)
  })
})

describe('isCIStep2Complete', () => {
  it('requires at least one saved pathway', () => {
    expect(isCIStep2Complete({ pathways: [] })).toBe(false)
    expect(isCIStep2Complete({})).toBe(false)
    expect(isCIStep2Complete({ pathways })).toBe(true)
  })
})

describe('isCIStep3Complete', () => {
  it('requires both a technical report and a GHGenius model', () => {
    expect(isCIStep3Complete({ documents: [] })).toBe(false)
    expect(
      isCIStep3Complete({ documents: [requiredDocuments[0]] })
    ).toBe(false)
    expect(
      isCIStep3Complete({ documents: [requiredDocuments[1]] })
    ).toBe(false)
    expect(isCIStep3Complete({ documents: requiredDocuments })).toBe(true)
  })
})

describe('getCIResumeStep', () => {
  it('opens Step 1 when there is no application or nothing is saved', () => {
    expect(getCIResumeStep(undefined)).toBe(CI_STEP_APPLICATION_INFO)
    expect(getCIResumeStep({})).toBe(CI_STEP_APPLICATION_INFO)
  })

  it('opens Step 2 when only Step 1 is saved', () => {
    expect(getCIResumeStep({ ...step1Fields })).toBe(
      CI_STEP_PROPOSED_PATHWAYS
    )
  })

  it('opens Step 3 when Steps 1–2 are saved', () => {
    expect(getCIResumeStep({ ...step1Fields, pathways })).toBe(
      CI_STEP_DOCUMENTS
    )
  })

  it('opens Step 4 when Steps 1–3 are saved', () => {
    expect(
      getCIResumeStep({
        ...step1Fields,
        pathways,
        documents: requiredDocuments
      })
    ).toBe(CI_STEP_SIGN_SUBMIT)
  })

  it('stops at the first incomplete step even if a later step has data', () => {
    // Pathways saved but Step 1 still incomplete -> resume on Step 1.
    expect(getCIResumeStep({ pathways })).toBe(CI_STEP_APPLICATION_INFO)
    // Documents saved but pathways missing -> resume on Step 2.
    expect(
      getCIResumeStep({ ...step1Fields, documents: requiredDocuments })
    ).toBe(CI_STEP_PROPOSED_PATHWAYS)
  })
})
