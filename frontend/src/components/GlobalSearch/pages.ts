import ROUTES from '@/routes/routes'
import { roles, type RoleName } from '@/constants/roles'

export interface PageLink {
  label: string
  route: string
  section: string
  keywords?: string[]
}

interface PageDefinition extends PageLink {
  audience?: 'gov' | 'org'
  anyRole?: RoleName[]
}

const PAGES: PageDefinition[] = [
  {
    label: 'Dashboard',
    route: ROUTES.DASHBOARD,
    section: 'Home',
    keywords: ['home', 'landing', 'overview']
  },
  {
    label: 'Notifications',
    route: ROUTES.NOTIFICATIONS.LIST,
    section: 'Notifications',
    keywords: ['alerts', 'messages', 'inbox']
  },
  {
    label: 'Notification settings',
    route: ROUTES.NOTIFICATIONS.SETTINGS,
    section: 'Notifications',
    keywords: ['configure', 'email', 'subscriptions', 'preferences']
  },
  {
    label: 'Transactions',
    route: ROUTES.TRANSACTIONS.LIST,
    section: 'Transactions',
    keywords: ['credits', 'units', 'ledger']
  },
  {
    label: 'Credit trading market',
    route: ROUTES.TRANSACTIONS.CREDIT_TRADING_MARKET,
    section: 'Transactions',
    keywords: ['market', 'buy', 'sell', 'listings']
  },
  {
    label: 'Credit trading market audit log',
    route: ROUTES.TRANSACTIONS.CREDIT_TRADING_MARKET_AUDIT_LOG,
    section: 'Transactions',
    audience: 'gov',
    keywords: ['market', 'history']
  },
  {
    label: 'New transfer',
    route: ROUTES.TRANSFERS.ADD,
    section: 'Transactions',
    anyRole: [roles.transfers, roles.government],
    keywords: ['create transfer', 'send credits']
  },
  {
    label: 'Compliance reporting',
    route: ROUTES.REPORTS.LIST,
    section: 'Compliance reporting',
    keywords: ['reports', 'annual report', 'submissions']
  },
  {
    label: 'Report openings',
    route: ROUTES.REPORTS.REPORT_OPENINGS,
    section: 'Compliance reporting',
    audience: 'gov',
    keywords: ['periods', 'open reports']
  },
  {
    label: 'Charging sites',
    route: ROUTES.REPORTS.CHARGING_SITE.INDEX,
    section: 'Compliance reporting',
    keywords: ['ev', 'chargers', 'stations']
  },
  {
    label: 'Manage FSE',
    route: ROUTES.REPORTS.MANAGE_FSE,
    section: 'Compliance reporting',
    keywords: ['final supply equipment', 'chargers']
  },
  {
    label: 'FSE map',
    route: ROUTES.REPORTS.FSE_MAP,
    section: 'Compliance reporting',
    keywords: ['final supply equipment', 'map', 'locations']
  },
  {
    label: 'Fuel codes',
    route: ROUTES.FUEL_CODES.LIST,
    section: 'Fuel codes',
    audience: 'gov',
    keywords: ['carbon intensity', 'ci']
  },
  {
    label: 'Fuel code bulletins',
    route: ROUTES.FUEL_CODES.BULLETINS,
    section: 'Fuel codes',
    keywords: ['bulletins', 'published fuel codes']
  },
  {
    label: 'My fuel codes',
    route: ROUTES.FUEL_CODES.MY_LIST,
    section: 'Fuel codes',
    audience: 'org',
    keywords: ['my codes']
  },
  {
    label: 'CI applications',
    route: ROUTES.CI_APPLICATIONS.LIST,
    section: 'Fuel codes',
    keywords: ['carbon intensity application', 'apply']
  },
  {
    label: 'Approved carbon intensities',
    route: ROUTES.APPROVED_CARBON_INTENSITIES,
    section: 'Reference',
    keywords: ['ci', 'approved', 'values']
  },
  {
    label: 'Compliance unit calculator',
    route: ROUTES.CREDIT_CALCULATOR,
    section: 'Reference',
    keywords: ['calculator', 'estimate', 'credits']
  },
  {
    label: 'Calculation data',
    route: ROUTES.CALCULATION_DATA,
    section: 'Reference',
    keywords: ['calculator', 'data', 'inputs']
  },
  {
    label: 'Release notes',
    route: ROUTES.RELEASE_NOTES,
    section: 'Reference',
    keywords: ['whats new', 'changes', 'version']
  },
  {
    label: 'Initiative agreements',
    route: ROUTES.INITIATIVE_AGREEMENTS.LIST,
    section: 'Initiative agreements',
    anyRole: [
      roles.ia_analyst,
      roles.ia_manager,
      roles.director,
      roles.ia_proponent
    ]
  },
  {
    label: 'Organizations',
    route: ROUTES.ORGANIZATIONS.LIST,
    section: 'Organizations',
    audience: 'gov',
    keywords: ['suppliers', 'companies']
  },
  {
    label: 'Organization profile',
    route: ROUTES.ORGANIZATION.ORG,
    section: 'Organization',
    audience: 'org',
    keywords: ['company', 'address', 'details']
  },
  {
    label: 'Organization users',
    route: ROUTES.ORGANIZATION.USERS,
    section: 'Organization',
    audience: 'org',
    keywords: ['people', 'staff', 'accounts']
  },
  {
    label: 'Credit ledger',
    route: ROUTES.ORGANIZATION.CREDIT_LEDGER,
    section: 'Organization',
    audience: 'org',
    keywords: ['balance', 'units']
  },
  {
    label: 'Administration',
    route: ROUTES.ADMIN.MAIN,
    section: 'Administration',
    audience: 'gov',
    anyRole: [roles.administrator, roles.system_admin]
  },
  {
    label: 'IDIR users',
    route: ROUTES.ADMIN.USERS.LIST,
    section: 'Administration',
    audience: 'gov',
    anyRole: [roles.administrator, roles.system_admin],
    keywords: ['government users', 'staff', 'accounts']
  },
  {
    label: 'User activity',
    route: ROUTES.ADMIN.USER_ACTIVITY,
    section: 'Administration',
    audience: 'gov',
    anyRole: [roles.administrator, roles.system_admin]
  },
  {
    label: 'User login history',
    route: ROUTES.ADMIN.USER_LOGIN_HISTORY,
    section: 'Administration',
    audience: 'gov',
    anyRole: [roles.administrator, roles.system_admin],
    keywords: ['logins', 'sign in']
  },
  {
    label: 'Audit log',
    route: ROUTES.ADMIN.AUDIT_LOG.LIST,
    section: 'Administration',
    audience: 'gov',
    anyRole: [roles.administrator, roles.system_admin],
    keywords: ['history', 'changes']
  }
]

type RoleCheck = (...roleNames: RoleName[]) => boolean

export const findPages = (
  query: string,
  isGov: boolean,
  hasAnyRole: RoleCheck,
  limit = 5
): PageLink[] => {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 2)
  if (!tokens.length) return []

  const scored = PAGES.filter((page) => {
    if (page.audience === 'gov' && !isGov) return false
    if (page.audience === 'org' && isGov) return false
    return !page.anyRole || hasAnyRole(...page.anyRole)
  })
    .map((page) => {
      const label = page.label.toLowerCase()
      const haystack = [label, page.section, ...(page.keywords ?? [])]
        .join(' ')
        .toLowerCase()
      if (!tokens.every((token) => haystack.includes(token))) return null
      const joined = tokens.join(' ')
      const score = label === joined ? 3 : label.startsWith(joined) ? 2 : 1
      return { page, score }
    })
    .filter(
      (entry): entry is { page: PageDefinition; score: number } =>
        entry !== null
    )
    .sort(
      (a, b) => b.score - a.score || a.page.label.localeCompare(b.page.label)
    )

  return scored.slice(0, limit).map(({ page }) => ({
    label: page.label,
    route: page.route,
    section: page.section,
    keywords: page.keywords
  }))
}
