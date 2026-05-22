import { useState } from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Tooltip,
  useTheme
} from '@mui/material'

import {
  useAssignCIApplicationAnalyst,
  useGetCIApplicationAnalysts
} from '@/hooks/useCIApplication'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from 'react-i18next'

export const CIAssignedAnalystCell = ({ data, onRefresh }) => {
  const { t } = useTranslation(['carbonIntensity'])
  const theme = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const { hasRoles } = useCurrentUser()
  const canAssign =
    hasRoles?.('Government', 'Analyst') ||
    hasRoles?.('Government', 'Compliance Manager') ||
    hasRoles?.('Government', 'Director')

  const { data: analysts = [], isLoading } = useGetCIApplicationAnalysts({
    enabled: canAssign
  })
  const { mutate: assignAnalyst, isPending } = useAssignCIApplicationAnalyst(
    data?.ciApplicationId
  )

  const currentAssignee = data?.assignedAnalyst
  const chipStyles = {
    backgroundColor: theme.palette.grey[600],
    color: theme.palette.common.white,
    fontWeight: 700,
    height: 28,
    width: 28,
    borderRadius: '50%',
    '& .MuiChip-label': { padding: 0 }
  }

  const renderChip = (analyst) => {
    if (!analyst) return <span>-</span>
    return (
      <Tooltip
        title={analyst.fullName || `${analyst.firstName} ${analyst.lastName}`}
      >
        <Chip label={analyst.initials} size="small" sx={chipStyles} />
      </Tooltip>
    )
  }

  if (!canAssign) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        height="100%"
      >
        {renderChip(currentAssignee)}
      </Box>
    )
  }

  if (isPending) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        height="100%"
      >
        <CircularProgress size={16} />
      </Box>
    )
  }

  return (
    <FormControl
      size="small"
      variant="standard"
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <Select
        value={currentAssignee?.userProfileId || ''}
        displayEmpty
        open={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        disabled={isLoading}
        onChange={(event) => {
          assignAnalyst(event.target.value || null, {
            onSuccess: () => {
              if (onRefresh) onRefresh()
            }
          })
          setIsOpen(false)
        }}
        renderValue={() => renderChip(currentAssignee)}
        sx={{
          height: '100%',
          minHeight: '32px',
          width: '100%',
          '& .MuiSelect-select': {
            padding: '4px 8px',
            fontSize: '12px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            minHeight: '24px'
          },
          '&:before': {
            borderBottom: 'none !important',
            content: '""'
          },
          '& .MuiInputBase-root': {
            width: '100%',
            height: '100%'
          },
          '& .MuiInput-root': {
            height: '100%',
            width: '100%'
          }
        }}
      >
        <MenuItem value="">
          <em>{t('carbonIntensity:unassign')}</em>
        </MenuItem>
        {analysts.map((analyst) => (
          <MenuItem key={analyst.userProfileId} value={analyst.userProfileId}>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip label={analyst.initials} size="small" sx={chipStyles} />
              <span>
                {analyst.firstName} {analyst.lastName}
              </span>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

export default CIAssignedAnalystCell
