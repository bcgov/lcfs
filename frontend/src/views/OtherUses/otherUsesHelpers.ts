interface OtherUseExpectedUseData {
  expectedUse?: string | null
  rationale?: string | null
}

export const isOtherExpectedUseMissing = (
  data?: OtherUseExpectedUseData | null
) => data?.expectedUse === 'Other' && !data?.rationale?.trim()
