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
import { useTranslation } from 'react-i18next'

import {
  useAssignDesignatedActionAnalyst,
  useInitiativeAgreementAnalysts
} from '@/hooks/useInitiativeAgreements'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'

// Assignment cell for the designated actions grid (#4896). IA managers and
// directors assign or reassign directly from the table; everyone else sees
// the read-only initials chip. Mirrors CIAssignedAnalystCell.
export const DAAssignedAnalystCell = ({ data }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const theme = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const { hasRoles } = useCurrentUser()
  const canAssign =
    hasRoles?.(roles.government, roles.ia_manager) ||
    hasRoles?.(roles.government, roles.director)

  const { data: analysts = [] } = useInitiativeAgreementAnalysts({
    enabled: canAssign
  })
  const { mutate: assignAnalyst, isPending } = useAssignDesignatedActionAnalyst(
    data?.designatedActionId
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

  const initialsOf = (analyst) =>
    analyst?.initials ||
    `${analyst?.firstName?.[0] || ''}${analyst?.lastName?.[0] || ''}`.toUpperCase()

  const renderChip = (analyst) => {
    if (!analyst) return <span>-</span>
    return (
      <Tooltip
        title={analyst.fullName || `${analyst.firstName} ${analyst.lastName}`}
      >
        <Chip label={initialsOf(analyst)} size="small" sx={chipStyles} />
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
        data-test="da-analyst-readonly"
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
        justifyContent: 'center'
      }}
    >
      <Select
        SelectDisplayProps={{
          'aria-label': t('initiativeAgreement:actions.columns.assignedAnalyst')
        }}
        data-test="da-analyst-select"
        value={currentAssignee?.userProfileId ?? ''}
        open={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        onChange={(event) =>
          assignAnalyst(event.target.value === '' ? null : event.target.value)
        }
        displayEmpty
        disableUnderline
        renderValue={() => renderChip(currentAssignee)}
        sx={{ '& .MuiSelect-select': { display: 'flex', py: 0 } }}
      >
        <MenuItem value="">
          <em>{t('initiativeAgreement:actions.unassigned')}</em>
        </MenuItem>
        {analysts.map((analyst) => (
          <MenuItem key={analyst.userProfileId} value={analyst.userProfileId}>
            {analyst.fullName}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

export default DAAssignedAnalystCell
