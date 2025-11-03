import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import {
  ClickAwayListener,
  Divider,
  FormControl,
  FormControlLabel,
  Paper,
  Popper,
  Radio,
  RadioGroup,
  IconButton
} from '@mui/material'
import { Close } from '@mui/icons-material'
import { useUpdateUser } from '@/hooks/useUser'
import { roles } from '@/constants/roles'
import { idirRoleOptions } from '@/views/Users/AddEditUser/_schema'
import withFeatureFlag from '@/utils/withFeatureFlag'
import { FEATURE_FLAGS } from '@/constants/config'

const RoleSwitcherComponent = ({
  currentUser,
  hasRoles,
  open,
  anchorEl,
  onClose
}) => {
  const { t } = useTranslation()
  const [selectedRole, setSelectedRole] = useState('')
  const [isAdministratorSelected, setIsAdministratorSelected] = useState(false)
  const [roleUpdateError, setRoleUpdateError] = useState(null)

  const isGovernmentAdmin =
    currentUser?.isGovernmentUser && hasRoles?.(roles.administrator)
  const idirOptions = useMemo(() => idirRoleOptions(t), [t])

  useEffect(() => {
    if (!currentUser?.roles) {
      setSelectedRole('')
      setIsAdministratorSelected(false)
      return
    }

    const normalizedRoles = currentUser.roles
      .map(({ name }) => name?.toLowerCase())
      .filter(Boolean)

    const hasAdminRole = normalizedRoles.includes(
      roles.administrator.toLowerCase()
    )

    const idirSelection =
      idirOptions.find((option) => normalizedRoles.includes(option.value)) ||
      null

    const nextRole = idirSelection?.value || ''

    setIsAdministratorSelected(hasAdminRole)
    setSelectedRole(nextRole)
  }, [currentUser?.roles, idirOptions])

  useEffect(() => {
    if (!isGovernmentAdmin && open) {
      onClose()
    }
  }, [isGovernmentAdmin, open, onClose])

  const { mutate: updateCurrentUserRoles, isPending: isUpdatingRoles } =
    useUpdateUser({
      onSuccess: (_data, variables) => {
        const meta = variables?.meta || {}
        if (typeof meta?.admin === 'boolean') {
          setIsAdministratorSelected(meta.admin)
        }
        if (meta?.role) {
          setSelectedRole(meta.role)
        }
        setRoleUpdateError(null)
        onClose()
      },
      onError: (error) => {
        console.error('Error updating current user roles:', error)
        setRoleUpdateError(t('common:submitError'))
      }
    })

  const handleSaveRoles = ({
    nextRole = selectedRole,
    nextAdmin = isAdministratorSelected
  } = {}) => {
    if (!currentUser?.userProfileId) {
      setRoleUpdateError(t('common:submitError'))
      return
    }

    if (!nextRole) {
      setRoleUpdateError(t('admin:userForm.selectRolePrompt'))
      return
    }

    const nextRoles = [
      ...(nextAdmin ? [roles.administrator.toLowerCase()] : []),
      nextRole,
      roles.government.toLowerCase()
    ]

    const payload = {
      userProfileId: currentUser.userProfileId,
      title: currentUser?.title || '',
      firstName: currentUser?.firstName || '',
      lastName: currentUser?.lastName || '',
      keycloakUsername: currentUser?.keycloakUsername || '',
      keycloakEmail: currentUser?.keycloakEmail || '',
      email: currentUser?.email || '',
      phone: currentUser?.phone || '',
      mobilePhone: currentUser?.mobilePhone || '',
      isActive:
        typeof currentUser?.isActive === 'boolean'
          ? currentUser.isActive
          : true,
      organizationId:
        currentUser?.organizationId ||
        currentUser?.organization?.organizationId ||
        null,
      roles: nextRoles
    }

    updateCurrentUserRoles({
      userID: currentUser.userProfileId,
      payload,
      meta: {
        admin: nextAdmin,
        role: nextRole
      }
    })
  }

  const handleRoleSelectionChange = (event) => {
    const value = event.target.value
    setSelectedRole(value)
    handleSaveRoles({ nextRole: value, nextAdmin: isAdministratorSelected })
  }

  const handleClose = (event) => {
    if (event) {
      if (
        anchorEl &&
        (anchorEl === event.target || anchorEl.contains(event.target))
      ) {
        return
      }
    }
    onClose()
    setRoleUpdateError(null)
  }

  if (!anchorEl) {
    return null
  }

  return (
    <Popper
      open={open && isGovernmentAdmin}
      anchorEl={anchorEl}
      placement="bottom-start"
      disablePortal={false}
      modifiers={[
        {
          name: 'offset',
          options: {
            offset: [1, 15]
          }
        }
      ]}
    >
      <ClickAwayListener onClickAway={handleClose}>
        <Paper
          elevation={6}
          sx={{
            minWidth: 240,
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
            border: 'none'
          }}
        >
          <BCBox
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            px={2}
            py={1}
            sx={{
              backgroundColor: 'secondary.main',
              height: '35px',
              width: '100%',
              borderRadius: '0'
            }}
          >
            <BCTypography
              variant="subtitle2"
              sx={{ fontWeight: 600, color: '#003366' }}
            >
              {t('roleSwitcher.title')}
            </BCTypography>
            <IconButton
              size="small"
              aria-label={t('roleSwitcher.close')}
              onClick={handleClose}
              sx={{
                color: '#003366'
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          </BCBox>
          <BCBox px={2} py={1}>
            <FormControl component="fieldset" disabled={isUpdatingRoles}>
              <RadioGroup
                value={selectedRole}
                onChange={handleRoleSelectionChange}
                aria-label={t('roleSwitcher.buttonLabel')}
              >
                {idirOptions.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    control={
                      <Radio
                        size="small"
                        sx={{
                          color: '#38598a',
                          '&.Mui-checked': { color: '#38598a' }
                        }}
                      />
                    }
                    label={
                      option.header ? (
                        <BCTypography variant="body4" component="span">
                          {option.header}
                        </BCTypography>
                      ) : (
                        option.label
                      )
                    }
                    sx={{ mt: 1 }}
                  />
                ))}
              </RadioGroup>
            </FormControl>
            {roleUpdateError && (
              <BCTypography
                variant="caption"
                color="error"
                sx={{ display: 'block', mt: 1.5 }}
              >
                {roleUpdateError}
              </BCTypography>
            )}
          </BCBox>
        </Paper>
      </ClickAwayListener>
    </Popper>
  )
}

RoleSwitcherComponent.propTypes = {
  currentUser: PropTypes.object,
  hasRoles: PropTypes.func,
  open: PropTypes.bool.isRequired,
  anchorEl: PropTypes.any,
  onClose: PropTypes.func.isRequired
}

export const RoleSwitcher = withFeatureFlag(
  RoleSwitcherComponent,
  FEATURE_FLAGS.ROLE_SWITCHER
)

RoleSwitcher.propTypes = RoleSwitcherComponent.propTypes

export { RoleSwitcherComponent as RoleSwitcherBase }
