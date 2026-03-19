import { Alert, Stack } from '@mui/material'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { AiAnalyticsPanel } from '@/features/ai-analytics/AiAnalyticsPanel'

export const AiAnalyticsPage = () => {
  const { hasAnyRole } = useCurrentUser()

  if (!hasAnyRole(roles.government)) {
    return (
      <Alert severity="warning">
        AI analytics is currently available only to government users because it can span
        cross-organization reporting entities.
      </Alert>
    )
  }

  return (
    <Stack spacing={3}>
      <AiAnalyticsPanel />
    </Stack>
  )
}
