import dayjs from 'dayjs'

export const CI_APPLICATION_STEPS = [
  { key: 'step1', labelKey: 'carbonIntensity:steps.step1' },
  { key: 'step2', labelKey: 'carbonIntensity:steps.step2' },
  { key: 'step3', labelKey: 'carbonIntensity:steps.step3' },
  { key: 'step4', labelKey: 'carbonIntensity:steps.step4' },
  { key: 'step5', labelKey: 'carbonIntensity:steps.step5' }
]

export const formatDate = (value) => (value ? dayjs(value).format('YYYY-MM-DD') : '')

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2)

const getUserName = (user) =>
  user?.fullName ||
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
  ''

const getUserInitials = (user) =>
  user?.initials || getInitials(getUserName(user))

const daysUntil = (date) => {
  if (!date) return null
  return dayjs(date).startOf('day').diff(dayjs().startOf('day'), 'day')
}

const daysSince = (date) => {
  if (!date) return null
  return dayjs().startOf('day').diff(dayjs(date).startOf('day'), 'day')
}

export const getSupplierRequestDate = (ciApplication) =>
  ciApplication?.supplierRequestDate ||
  (ciApplication?.documentUploadEnabled
    ? ciApplication?.documentChangesRequestedAt
    : null) ||
  (ciApplication?.pathwaySupplementalEditEnabled
    ? ciApplication?.pathwayChangesRequestedAt
    : null)

const riskLabel = (risk) => (risk === 'Medium' ? 'Moderate' : risk)

const riskMeta = (risk, score) => {
  if (!risk && score == null) return ''
  return [risk ? `${riskLabel(risk)} risk` : null, score ?? null]
    .filter((part) => part !== null && part !== '')
    .join(' - ')
}

export const buildCIWorkflowSteps = (
  ciApplication = {},
  { showInternalSteps = true } = {}
) => {
  const status = ciApplication?.status?.status
  const isSubmitted = Boolean(ciApplication.signatureDateTime)
  const isApproved = status === 'Completed'
  const isWithdrawn = status === 'Withdrawn'
  const risk = ciApplication.preliminaryRiskAssessment
  // Medium and High risk applications both go through Verification 2; only Low
  // risk completes after Verification 1. Legacy rows may store 'Moderate'
  // instead of 'Medium' (#4741).
  const showVerification2 = ['Medium', 'Moderate', 'High'].includes(risk)
  const recommendationComplete = Boolean(ciApplication.recommendationDate)
  const targetDate = ciApplication.proposedFuelCodeEffectiveDate
  const supplierRequestDate = getSupplierRequestDate(ciApplication)

  const submitterName =
    ciApplication.signatureUserDisplayName || ciApplication.signatureUser || ''
  const verification1Complete = Boolean(ciApplication.verification1Date)
  const verification2Complete = Boolean(ciApplication.verification2Date)

  const steps = [
    {
      key: 'submitted',
      label: 'Submitted',
      date: ciApplication.signatureDateTime,
      state: isSubmitted ? 'completed' : 'pending',
      initials: getInitials(submitterName),
      tooltip: submitterName
    }
  ]

  if (showInternalSteps) {
    steps.push({
      key: 'verification1',
      label: 'Verification 1',
      date: ciApplication.verification1Date,
      meta: riskMeta(
        ciApplication.preliminaryRiskAssessment,
        ciApplication.priorityScore
      ),
      state: verification1Complete ? 'completed' : 'pending',
      initials: verification1Complete
        ? getUserInitials(ciApplication.verification1User)
        : getUserInitials(ciApplication.assignedAnalyst),
      tooltip: verification1Complete
        ? getUserName(ciApplication.verification1User)
        : getUserName(ciApplication.assignedAnalyst)
    })
  }

  if (showInternalSteps && showVerification2) {
    steps.push({
      key: 'verification2',
      label: 'Verification 2',
      date: ciApplication.verification2Date,
      meta: riskMeta(
        ciApplication.verification2RiskAssessment,
        ciApplication.verification2PriorityScore
      ),
      state: verification2Complete ? 'completed' : 'pending',
      initials: verification2Complete
        ? getUserInitials(ciApplication.verification2User)
        : getUserInitials(ciApplication.assignedAnalyst),
      tooltip: verification2Complete
        ? getUserName(ciApplication.verification2User)
        : getUserName(ciApplication.assignedAnalyst)
    })
  }

  if (supplierRequestDate) {
    steps.push({
      // Within the CI application process the external party is the "applicant"
      // (the org that submitted the application), not a "supplier" (#4743). The
      // step key stays 'withSupplier' to avoid touching state/data plumbing.
      key: 'withSupplier',
      label: 'With applicant',
      date: supplierRequestDate,
      state: 'waiting',
      icon: 'hourglass',
      countdown: daysSince(supplierRequestDate)
    })
  }

  if (showInternalSteps && recommendationComplete) {
    steps.push({
      key: 'recommendation',
      label: 'Recommend to director',
      date: ciApplication.recommendationDate,
      state: 'completed',
      initials: getUserInitials(ciApplication.recommendationUser),
      tooltip: getUserName(ciApplication.recommendationUser)
    })
  }

  if (isApproved) {
    steps.push({
      key: 'approved',
      label: 'Approved',
      date: ciApplication.approvalDate,
      state: 'completed',
      initials: getUserInitials(ciApplication.approvalUser),
      tooltip: getUserName(ciApplication.approvalUser)
    })
  } else if (isWithdrawn) {
    steps.push({
      key: 'withdrawn',
      label: 'Withdrawn',
      date: ciApplication.updateDate,
      state: 'completed',
      icon: 'close'
    })
  } else {
    steps.push({
      key: 'target',
      label: 'Proposed effective date',
      date: targetDate,
      state: 'target',
      countdown: daysUntil(targetDate)
    })
  }

  return steps
}

export const getCIWorkflowConnectorStyle = (currentStep, nextStep) =>
  currentStep?.state === 'completed' && nextStep?.state === 'completed'
    ? 'solid'
    : 'dotted'

