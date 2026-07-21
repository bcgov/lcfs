import {
  DOC_CATEGORY_GHGENIUS_MODEL,
  DOC_CATEGORY_TECHNICAL_REPORT
} from './components/DocumentsModellingStep'

// 0-based indices into CI_APPLICATION_STEPS (see CIApplicationProgress.jsx).
export const CI_STEP_APPLICATION_INFO = 0
export const CI_STEP_PROPOSED_PATHWAYS = 1
export const CI_STEP_DOCUMENTS = 2
export const CI_STEP_SIGN_SUBMIT = 3

// A step counts as "complete" only when the required fields it persists are
// present on the saved draft. These mirror the per-step validation in
// ApplicationInformationStep (city + province/state + country + positive
// capacity + unit),
// ProposedFuelPathwaysStep (at least one pathway) and DocumentsModellingStep
// (technical report + GHGenius model uploaded).
export const isCIStep1Complete = (ciApplication) =>
  Boolean(
    ciApplication?.facilityCountry &&
      ciApplication?.facilityCity &&
      ciApplication?.facilityProvinceState &&
      Number(ciApplication?.facilityNameplateCapacity) > 0 &&
      ciApplication?.facilityNameplateCapacityUnit
  )

export const isCIStep2Complete = (ciApplication) =>
  Array.isArray(ciApplication?.pathways) && ciApplication.pathways.length > 0

export const isCIStep3Complete = (ciApplication) => {
  const documents = ciApplication?.documents ?? []
  const hasTechnicalReport = documents.some(
    (d) => d.documentCategory === DOC_CATEGORY_TECHNICAL_REPORT
  )
  const hasGHGeniusModel = documents.some(
    (d) => d.documentCategory === DOC_CATEGORY_GHGENIUS_MODEL
  )
  return hasTechnicalReport && hasGHGeniusModel
}

/**
 * Determine which wizard step a draft CI application should open on: the
 * first step whose required fields have not yet been saved. When steps 1–3
 * are all complete the applicant resumes on Step 4 (Sign & submit); when no
 * step has been completed (or there is no application yet) it falls back to
 * Step 1. Returns a 0-based index into CI_APPLICATION_STEPS.
 *
 * The result is derived purely from data the detail endpoint already returns,
 * so it survives logout/login and is identical for any user opening the same
 * draft (#4588).
 */
export const getCIResumeStep = (ciApplication) => {
  if (!ciApplication) return CI_STEP_APPLICATION_INFO
  if (!isCIStep1Complete(ciApplication)) return CI_STEP_APPLICATION_INFO
  if (!isCIStep2Complete(ciApplication)) return CI_STEP_PROPOSED_PATHWAYS
  if (!isCIStep3Complete(ciApplication)) return CI_STEP_DOCUMENTS
  return CI_STEP_SIGN_SUBMIT
}
