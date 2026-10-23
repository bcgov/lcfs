import PropTypes from 'prop-types'
import { useMemo } from 'react'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import MenuList from '@mui/material/MenuList'
import MenuItem from '@mui/material/MenuItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import Avatar from '@mui/material/Avatar'
import CircularProgress from '@mui/material/CircularProgress'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import {
  getMentionOptionId,
  MENTION_COLORS,
  MENTION_LISTBOX_ID
} from './mentionUtils'

const {
  border: MENTION_BORDER,
  select: MENTION_SELECT,
  activeBlue: MENTION_ACTIVE_BLUE,
  text: MENTION_TEXT,
  muted: MENTION_MUTED
} = MENTION_COLORS
const MENTION_RADIUS = '4px'

const getMentionInitials = (name) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

// Popper anchored to the caret (a virtual element), since Quill's
// contenteditable has no DOM node for the caret position.
const MentionDropdown = ({
  getAnchorRect,
  results,
  isLoading,
  activeIndex,
  onHoverIndex,
  onSelect,
  t
}) => {
  const virtualAnchor = useMemo(
    () => ({ getBoundingClientRect: getAnchorRect }),
    [getAnchorRect]
  )

  return (
    <Popper
      open
      anchorEl={virtualAnchor}
      placement="bottom-start"
      transition
      sx={{ zIndex: 1500 }}
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={120}>
          <Paper
            elevation={0}
            // Keep focus in the editor when clicking the list or its scrollbar.
            onMouseDown={(event) => event.preventDefault()}
            sx={{
              mt: 0.5,
              minWidth: 240,
              maxWidth: 320,
              maxHeight: 256,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: MENTION_RADIUS,
              border: `1px solid ${MENTION_BORDER}`,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)'
            }}
          >
            <MenuList
              dense
              id={MENTION_LISTBOX_ID}
              role="listbox"
              aria-label={t('internalComment:mentionListLabel')}
              sx={{ py: 0, overflowY: 'auto', minHeight: 0 }}
            >
              {results.length === 0 && (
                <MenuItem disabled sx={{ gap: 1, py: 1.25, px: 1.75 }}>
                  {isLoading ? (
                    <>
                      <CircularProgress
                        size={14}
                        thickness={5}
                        sx={{ color: MENTION_ACTIVE_BLUE }}
                      />
                      <BCTypography
                        variant="body2"
                        sx={{ color: MENTION_MUTED, fontSize: '0.8125rem' }}
                      >
                        {t('internalComment:mentionSearching')}
                      </BCTypography>
                    </>
                  ) : (
                    <>
                      <PersonSearchOutlinedIcon
                        fontSize="small"
                        sx={{ color: MENTION_MUTED, opacity: 0.6 }}
                      />
                      <BCTypography
                        variant="body2"
                        sx={{ color: MENTION_MUTED, fontSize: '0.8125rem' }}
                      >
                        {t('internalComment:mentionNoResults')}
                      </BCTypography>
                    </>
                  )}
                </MenuItem>
              )}
              {results.map((user, index) => {
                const isActive = index === activeIndex
                return (
                  <MenuItem
                    key={user.userProfileId}
                    id={getMentionOptionId(index)}
                    role="option"
                    aria-selected={isActive}
                    selected={isActive}
                    onMouseEnter={() => onHoverIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelect(user)}
                    disableGutters
                    sx={{
                      gap: 1,
                      py: 0.625,
                      px: 1.75,
                      transition: 'background-color 120ms ease',
                      '&.Mui-selected, &.Mui-selected:hover, &:hover': {
                        bgcolor: MENTION_SELECT
                      }
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: 30 }}>
                      <Avatar
                        sx={{
                          width: 24,
                          height: 24,
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          bgcolor: MENTION_SELECT,
                          color: MENTION_ACTIVE_BLUE
                        }}
                      >
                        {getMentionInitials(user.displayName)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={user.displayName}
                      secondary={user.email}
                      primaryTypographyProps={{
                        noWrap: true,
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        sx: { color: MENTION_TEXT }
                      }}
                      secondaryTypographyProps={{
                        noWrap: true,
                        fontSize: '0.75rem',
                        sx: { color: MENTION_MUTED }
                      }}
                    />
                  </MenuItem>
                )
              })}
            </MenuList>
            {results.length > 0 && (
              <BCBox
                sx={{
                  flexShrink: 0,
                  px: 1.75,
                  py: 0.5,
                  display: 'flex',
                  gap: 1.5,
                  borderTop: `1px solid ${MENTION_BORDER}`
                }}
              >
                <BCTypography
                  variant="caption"
                  sx={{ color: MENTION_MUTED, fontSize: '0.6875rem' }}
                >
                  &#8593;&#8595; {t('internalComment:mentionNavigateHint')}
                </BCTypography>
                <BCTypography
                  variant="caption"
                  sx={{ color: MENTION_MUTED, fontSize: '0.6875rem' }}
                >
                  &#8629; {t('internalComment:mentionSelectHint')}
                </BCTypography>
              </BCBox>
            )}
          </Paper>
        </Fade>
      )}
    </Popper>
  )
}

MentionDropdown.propTypes = {
  getAnchorRect: PropTypes.func.isRequired,
  results: PropTypes.array.isRequired,
  isLoading: PropTypes.bool,
  activeIndex: PropTypes.number.isRequired,
  onHoverIndex: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired
}

export default MentionDropdown
