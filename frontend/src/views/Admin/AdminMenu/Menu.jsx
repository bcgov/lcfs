import BCBox from '@/components/BCBox'
import { ROUTES } from '@/routes/routes'
import breakpoints from '@/themes/base/breakpoints'
import { AdminTabPanel } from '@/views/Admin/AdminMenu/components/AdminTabPanel'
import { AppBar, Tab, Tabs } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Users,
  SeededUserAssociation,
  UserActivity,
  UserLoginHistory,
  AuditLog,
  LoginScreenBackground
} from '.'
import { roles } from '@/constants/roles'
import { CONFIG } from '@/constants/config'
import { useCurrentUser } from '@/hooks/useCurrentUser'

function a11yProps(index) {
  return {
    id: `full-width-tab-${index}`,
    'aria-controls': `full-width-admin-tabs-${index}`
  }
}

export function AdminMenu() {
  const { t } = useTranslation(['admin'])
  const [tabsOrientation, setTabsOrientation] = useState('horizontal')
  const navigate = useNavigate()
  const location = useLocation()
  const { hasRoles } = useCurrentUser()

  const isAdmin = hasRoles(roles.administrator)
  const isSystemAdmin = hasRoles(roles.system_admin)

  const normalizedEnvironment = (CONFIG.ENVIRONMENT || '').toLowerCase()
  const showSeededAssociation = [
    'local',
    'development',
    'dev',
    'test'
  ].includes(normalizedEnvironment)
  const showSeededAssociationAdminOnly = showSeededAssociation && isAdmin

  const tabs = useMemo(() => {
    const list = []
    if (isAdmin) {
      list.push(
        {
          key: 'users',
          label: t('Users'),
          path: ROUTES.ADMIN.USERS.LIST,
          component: <Users />,
          wrapped: true
        },
        {
          key: 'userActivity',
          label: t('UserActivity'),
          path: ROUTES.ADMIN.USER_ACTIVITY,
          component: <UserActivity />
        },
        {
          key: 'userLoginHistory',
          label: t('UserLoginHistory'),
          path: ROUTES.ADMIN.USER_LOGIN_HISTORY,
          component: <UserLoginHistory />
        },
        {
          key: 'auditLog',
          label: t('AuditLog'),
          path: ROUTES.ADMIN.AUDIT_LOG.LIST,
          component: <AuditLog />
        }
      )
    }
    if (isSystemAdmin) {
      list.push({
        key: 'loginScreenBackground',
        label: t('LoginScreenBackground'),
        path: ROUTES.ADMIN.LOGIN_SCREEN_BACKGROUND,
        component: <LoginScreenBackground />
      })
    }
    if (showSeededAssociationAdminOnly) {
      list.push({
        key: 'seededUserAssociation',
        label: t('SeededUserAssociation'),
        path: ROUTES.ADMIN.SEEDED_USER_ASSOCIATION,
        component: <SeededUserAssociation />,
        wrapped: true
      })
    }
    return list
  }, [isAdmin, isSystemAdmin, showSeededAssociationAdminOnly, t])

  const tabIndex = useMemo(() => {
    const index = tabs.findIndex(
      (tab) =>
        location.pathname === tab.path ||
        location.pathname === `${tab.path}/`
    )
    return index === -1 ? false : index
  }, [location.pathname, tabs])

  useEffect(() => {
    function handleTabsOrientation() {
      return window.innerWidth < breakpoints.values.lg
        ? setTabsOrientation('vertical')
        : setTabsOrientation('horizontal')
    }

    window.addEventListener('resize', handleTabsOrientation)
    handleTabsOrientation()

    return () => window.removeEventListener('resize', handleTabsOrientation)
  }, [tabsOrientation])

  const handleSetTabValue = (event, newValue) => {
    const next = tabs[newValue]
    if (next) {
      navigate(next.path)
    }
  }

  if (tabs.length === 0) {
    return null
  }

  return (
    <BCBox sx={{ bgcolor: 'background.paper' }}>
      <AppBar position="static" sx={{ boxShadow: 'none', border: 'none' }}>
        <Tabs
          sx={{ background: 'rgb(0, 0, 0, 0.08)', width: 'auto' }}
          orientation={tabsOrientation}
          value={tabIndex}
          aria-label="Tabs for selection of administration options"
          onChange={handleSetTabValue}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.key}
              label={tab.label}
              wrapped={tab.wrapped}
              {...a11yProps(index)}
            />
          ))}
        </Tabs>
      </AppBar>
      {tabs.map((tab, index) => (
        <AdminTabPanel
          key={tab.key}
          value={tabIndex}
          index={index}
          component="div"
          mx={-3}
        >
          {tab.component}
        </AdminTabPanel>
      ))}
    </BCBox>
  )
}
