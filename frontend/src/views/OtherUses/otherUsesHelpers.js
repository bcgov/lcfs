export const isOtherExpectedUseMissing = (data) =>
  data?.expectedUse === 'Other' && !data?.rationale?.trim()
