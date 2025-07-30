import { describe, it, expect, beforeEach, vi } from 'vitest'
import { roles } from '@/constants/roles'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  TextRenderer,
  LinkRenderer,
  SelectRenderer,
  MultiSelectRenderer,
  YesNoTextRenderer,
  StatusRenderer,
  ConditionalLinkRenderer,
  LoginStatusRenderer,
  OrgStatusRenderer,
  FuelCodeStatusRenderer,
  FuelCodePrefixRenderer,
  TransactionStatusRenderer,
  ReportsStatusRenderer,
  RoleSpanRenderer,
  RoleRenderer,
  CommonArrayRenderer
} from '../cellRenderers'

// Provide stub implementations for BCBadge and BCBox to avoid heavy MUI rendering
vi.mock('@/components/BCBadge', () => ({
  __esModule: true,
  default: ({ badgeContent, children, ...rest }) => (
    <span data-testid="bc-badge" {...rest}>
      {badgeContent}
      {children}
    </span>
  )
}))

vi.mock('@/components/BCBox', () => ({
  __esModule: true,
  default: ({ children, component = 'div', ...rest }) => {
    const Comp = component
    return <Comp {...rest}>{children}</Comp>
  }
}))

vi.mock('@/components/BCUserInitials/BCUserInitials', () => ({
  __esModule: true,
  default: () => <span data-testid="user-initials" />
}))

// ResizeObserver is not implemented in JSDOM by default
beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }

  // Provide a default offsetWidth so GenericChipRenderer has predictable width calculations
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 300
  })
})

describe('TextRenderer', () => {
  it('renders formatted value when provided', () => {
    render(
      <MemoryRouter>
        <TextRenderer value="raw" valueFormatted="formatted" />
      </MemoryRouter>
    )
    expect(screen.getByText('formatted')).toBeInTheDocument()
  })
})

describe('YesNoTextRenderer', () => {
  it('renders Yes/No based on boolean value', () => {
    const { rerender } = render(
      <MemoryRouter>
        <YesNoTextRenderer value />
      </MemoryRouter>
    )
    expect(screen.getByText('Yes')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <YesNoTextRenderer value={false} />
      </MemoryRouter>
    )
    expect(screen.getByText('No')).toBeInTheDocument()
  })
})

describe('StatusRenderer', () => {
  it('displays Active or Inactive badge based on data.isActive', () => {
    const activeData = { isActive: true }
    const inactiveData = { isActive: false }

    const { rerender } = render(
      <MemoryRouter>
        <StatusRenderer data={activeData} />
      </MemoryRouter>
    )
    expect(screen.getByText(/Active/i)).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <StatusRenderer data={inactiveData} />
      </MemoryRouter>
    )
    expect(screen.getByText(/Inactive/i)).toBeInTheDocument()
  })
})

describe('CommonArrayRenderer', () => {
  it('renders chips for comma-separated string', () => {
    render(
      <MemoryRouter>
        {/* node and colDef props are minimally mocked for GenericChipRenderer */}
        <CommonArrayRenderer
          value="Apple, Banana, Cherry"
          data={{}}
          node={{ id: '1' }}
          colDef={{}}
        />
      </MemoryRouter>
    )

    expect(screen.getByText(/Apple/i)).toBeInTheDocument()
    expect(screen.getByText(/Banana/i)).toBeInTheDocument()
    expect(screen.getByText(/Cherry/i)).toBeInTheDocument()
  })
})

describe('LinkRenderer', () => {
  it('creates a link to node id when no custom url provided', () => {
    render(
      <MemoryRouter initialEntries={['/base']}>
        <LinkRenderer value="Link Text" node={{ id: '123' }} />
      </MemoryRouter>
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/base/123')
    expect(link).toHaveTextContent('Link Text')
  })
})

describe('SelectRenderer & MultiSelectRenderer', () => {
  const baseParams = {
    colDef: {
      cellEditorParams: {
        options: ['A', 'B']
      },
      editable: true
    },
    value: null
  }

  it('SelectRenderer shows placeholder when editable with options', () => {
    render(
      <MemoryRouter>
        <SelectRenderer {...baseParams} />
      </MemoryRouter>
    )
    expect(screen.getByText('Select')).toBeInTheDocument()
  })

  it('MultiSelectRenderer shows chips when value present', () => {
    const params = {
      ...baseParams,
      value: 'X',
      data: {},
      node: { id: '1' }
    }
    render(
      <MemoryRouter>
        <MultiSelectRenderer {...params} />
      </MemoryRouter>
    )
    // since MultiSelectRenderer with value renders CommonArrayRenderer which we stub indirectly, we just check for value
    expect(screen.getByText('X')).toBeInTheDocument()
  })
})

/* -------------------------------------------------------------------------
 * Additional component tests (merged from cellRenderers.extra.test.jsx)
 * -----------------------------------------------------------------------*/

describe('Additional cellRenderers components', () => {
  // For overflow-chip tests we need a narrow container width
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      value: 150
    })
  })

  it('ConditionalLinkRenderer returns LinkRenderer when condition true', () => {
    const CondRenderer = ConditionalLinkRenderer(() => true)
    render(
      <MemoryRouter>
        <CondRenderer value="Hi" node={{ id: '1' }} />
      </MemoryRouter>
    )
    expect(screen.getByRole('link')).toHaveTextContent('Hi')
  })

  it('ConditionalLinkRenderer renders TextRenderer when condition false', () => {
    const CondRenderer = ConditionalLinkRenderer(() => false)
    render(
      <MemoryRouter>
        <CondRenderer value="Plain" valueFormatted="Plain" />
      </MemoryRouter>
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Plain')).toBeInTheDocument()
  })

  it('LoginStatusRenderer shows Success badge for successful login', () => {
    render(
      <MemoryRouter>
        <LoginStatusRenderer data={{ isLoginSuccessful: true }} />
      </MemoryRouter>
    )
    expect(screen.getByText(/Success/i)).toBeInTheDocument()
  })

  it('OrgStatusRenderer displays organization status', () => {
    render(
      <MemoryRouter initialEntries={['/orgs']}>
        <OrgStatusRenderer
          data={{ orgStatus: { status: 'Registered' } }}
          node={{ id: '10' }}
        />
      </MemoryRouter>
    )
    expect(screen.getByText(/Registered/i)).toBeInTheDocument()
  })

  it('FuelCodeStatusRenderer displays fuel code status', () => {
    render(
      <MemoryRouter initialEntries={['/fuel']}>
        <FuelCodeStatusRenderer
          data={{ status: 'Approved' }}
          node={{ id: '11' }}
        />
      </MemoryRouter>
    )
    expect(screen.getByText(/Approved/i)).toBeInTheDocument()
  })

  it('FuelCodePrefixRenderer shows flag when country provided', () => {
    render(
      <MemoryRouter initialEntries={['/prefix']}>
        <FuelCodePrefixRenderer
          data={{ prefix: 'ABC', fuelProductionFacilityCountry: 'Canada' }}
          node={{ id: '12' }}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('ABC')).toBeInTheDocument()
  })

  it('TransactionStatusRenderer renders badge for status', () => {
    render(
      <MemoryRouter>
        <TransactionStatusRenderer data={{ status: 'Recorded' }} />
      </MemoryRouter>
    )
    expect(screen.getByText(/Recorded/i)).toBeInTheDocument()
  })

  it('ReportsStatusRenderer renders badge for report status', () => {
    render(
      <MemoryRouter>
        <ReportsStatusRenderer data={{ reportStatus: 'Draft' }} />
      </MemoryRouter>
    )
    expect(screen.getByText(/Draft/i)).toBeInTheDocument()
  })

  it('RoleSpanRenderer renders filtered roles', () => {
    const data = {
      roles: [
        { roleId: 1, name: 'Administrator', isGovernmentRole: true },
        { roleId: 2, name: roles.supplier, isGovernmentRole: false }
      ]
    }
    render(
      <MemoryRouter>
        <RoleSpanRenderer data={data} />
      </MemoryRouter>
    )
    expect(screen.getByText(/Administrator/i)).toBeInTheDocument()
    expect(screen.queryByText(roles.supplier)).toBeNull()
  })

  it('RoleRenderer differentiates government roles and shows overflow', () => {
    const rolesString = `${roles.government}, One, Two, Three, Four, Five, Six`
    render(
      <MemoryRouter>
        <RoleRenderer
          value={rolesString}
          data={{}}
          node={{ id: '20' }}
          colDef={{}}
        />
      </MemoryRouter>
    )
    expect(screen.getByText(/One/)).toBeInTheDocument()
    expect(screen.getByText(/\+/)).toBeInTheDocument()
  })

  it('CommonArrayRenderer displays overflow chip when width limited', () => {
    render(
      <MemoryRouter>
        <CommonArrayRenderer
          value="Apple, Banana, Cherry, Dragonfruit, Elderberry, Fig"
          data={{}}
          node={{ id: '99' }}
          colDef={{}}
        />
      </MemoryRouter>
    )
    expect(screen.getByText(/\+[0-9]+/)).toBeInTheDocument()
  })
})
