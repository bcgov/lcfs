export const CI_APPLICATION_CHANGES_REQUESTED_LABEL = 'Changes requested'

export type CIApplicationDisplayStatusData = {
  status?: { status?: string }
  pathwaySupplementalEditEnabled?: boolean
  pathway_supplemental_edit_enabled?: boolean
  documentUploadEnabled?: boolean
  document_upload_enabled?: boolean
}

export const getCIApplicationDisplayStatus = (
  data?: CIApplicationDisplayStatusData
) => {
  const supplementalRequestOpen =
    data?.pathwaySupplementalEditEnabled ||
    data?.pathway_supplemental_edit_enabled ||
    data?.documentUploadEnabled ||
    data?.document_upload_enabled

  if (data?.status?.status === 'Submitted' && supplementalRequestOpen) {
    return CI_APPLICATION_CHANGES_REQUESTED_LABEL
  }
  return data?.status?.status
}
