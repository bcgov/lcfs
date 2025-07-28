import { useState } from 'react'
import {
  Select,
  MenuItem,
  FormControl,
  Chip,
  Box,
  CircularProgress,
  Tooltip,
  useTheme
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import {
  useGetAvailableAnalysts,
  useAssignAnalyst
} from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { CancelScheduleSend } from '@mui/icons-material'

export const AssignedAnalystCell = ({ data, onRefresh }) => {
  const { t } = useTranslation(['report'])
  const [isOpen, setIsOpen] = useState(false)
  const { hasRoles } = useCurrentUser()
  const theme = useTheme()

  // Reusable chip styles
  const getAnalystChipStyles = (size = 'large') => ({
    backgroundColor: theme.palette.grey[600],
    color: theme.palette.common.white,
    fontWeight: 'bold',
    fontSize: size === 'large' ? '13px' : '12px',
    height: size === 'large' ? '32px' : '28px',
    width: size === 'large' ? '32px' : '28px',
    borderRadius: '50%',
    '& .MuiChip-label': {
      padding: 0
    }
  })

  const commonBoxStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  }

  const { data: analysts = [], isLoading: loadingAnalysts } =
    useGetAvailableAnalysts()

  const { mutate: assignAnalyst, isLoading: assigning } = useAssignAnalyst({
    onSuccess: () => {
      if (onRefresh) onRefresh()
    }
  })

  // Check if user can assign analysts (IDIR users only)
  const canAssign = hasRoles('Government', 'Analyst')

  const handleAssignment = (analystId) => {
    assignAnalyst({
      reportId: data.complianceReportId,
      assignedAnalystId: analystId || null
    })
    setIsOpen(false)
  }

  const currentAssignee = data.assignedAnalyst

  // Helper function for read-only display
  const renderReadOnlyView = () => {
    if (!currentAssignee) {
      return (
        <Box sx={commonBoxStyles}>
          <span>-</span>
        </Box>
      )
    }

    return (
      <Box sx={commonBoxStyles}>
        <Tooltip
          title={`${currentAssignee.firstName} ${currentAssignee.lastName}`}
        >
          <Chip
            label={currentAssignee.initials}
            size="small"
            sx={getAnalystChipStyles('large')}
          />
        </Tooltip>
      </Box>
    )
  }

  if (!canAssign) {
    return renderReadOnlyView()
  }

  if (assigning) {
    return (
      <Box sx={commonBoxStyles}>
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
        onChange={(e) => handleAssignment(e.target.value)}
        displayEmpty
        open={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        disabled={loadingAnalysts}
        renderValue={(selected) => {
          if (!selected || !currentAssignee) {
            return
          }

          return (
            <Tooltip
              title={`${currentAssignee.firstName} ${currentAssignee.lastName}`}
            >
              <Chip
                label={currentAssignee.initials}
                size="small"
                sx={getAnalystChipStyles('large')}
              />
            </Tooltip>
          )
        }}
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
          <em>{t('report:unassign')}</em>
        </MenuItem>
        {analysts.map((analyst) => (
          <MenuItem key={analyst.userProfileId} value={analyst.userProfileId}>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={analyst.initials}
                size="small"
                sx={getAnalystChipStyles('small')}
              />
              <span style={{ fontSize: '12px' }}>
                {analyst.firstName} {analyst.lastName}
              </span>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
