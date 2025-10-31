import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi
} from 'vitest'
import { RoleSwitcher } from '../RoleSwitcher'
import { useUpdateUser } from '@/hooks/useUser'
import { idirRoleOptions } from '@/views/Users/AddEditUser/_schema'
import { wrapper } from '@/tests/utils/wrapper'
import { CONFIG } from '@/constants/config'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/components/BCBox', () => ({
  default: ({
    children,
    display,
    alignItems,
    justifyContent,
    px,
    py,
    sx,
    style,
    ...props
  }) => (
    <div
      {...props}
      style={{
        display,
        alignItems,
        justifyContent,
        paddingLeft: px ? `${px}rem` : undefined,
        paddingRight: px ? `${px}rem` : undefined,
        paddingTop: py ? `${py}rem` : undefined,
        paddingBottom: py ? `${py}rem` : undefined,
        ...style
      }}
    >
      {children}
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, variant, color, sx, component, ...props }) => {
    const Component = component || 'span'
    return <Component {...props}>{children}</Component>
  }
}))

vi.mock('@/components/BCForm/CustomLabel', () => ({
  CustomLabel: ({ children }) => <label>{children}</label>
}))

vi.mock('@/hooks/useUser')
vi.mock('@/views/Users/AddEditUser/_schema')

const mutateMock = vi.fn()
let hookOptions
const originalRoleSwitcherFlag = CONFIG.feature_flags.roleSwitcher

const defaultUser = {
  userProfileId: 'user123',
  firstName: 'John',
  lastName: 'Doe',
  isGovernmentUser: true,
  title: 'Manager',
  keycloakUsername: 'jdoe',
  keycloakEmail: 'john.doe@example.com',
  email: 'john.doe@example.com',
  phone: '1234567890',
  mobilePhone: '0987654321',
  isActive: true,
  organization: { organizationId: 'org123' },
  roles: [
    { name: 'Government' },
    { name: 'Administrator' },
    { name: 'Analyst' }
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  mutateMock.mockReset()
  hookOptions = null
  CONFIG.feature_flags.roleSwitcher = true

  vi.mocked(idirRoleOptions).mockReturnValue([
    { label: 'Analyst', value: 'analyst' },
    { label: 'Director', value: 'director' }
  ])

  vi.mocked(useUpdateUser).mockImplementation((options) => {
    hookOptions = options
    return { mutate: mutateMock, isPending: false }
  })
})

afterEach(() => {
  CONFIG.feature_flags.roleSwitcher = originalRoleSwitcherFlag
})

const createAnchor = () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  return anchor
}

describe('RoleSwitcher', () => {
  it('returns null when anchor element is not provided', () => {
    const { container } = render(
      <RoleSwitcher
        currentUser={defaultUser}
        hasRoles={() => true}
        open
        anchorEl={null}
        onClose={vi.fn()}
      />,
      { wrapper }
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('does not render when role switcher feature flag is disabled', () => {
    const anchor = createAnchor()
    const onClose = vi.fn()

    CONFIG.feature_flags.roleSwitcher = false

    const { container } = render(
      <RoleSwitcher
        currentUser={defaultUser}
        hasRoles={(role) => role === 'Administrator'}
        open
        anchorEl={anchor}
        onClose={onClose}
      />,
      { wrapper }
    )

    expect(container).toBeEmptyDOMElement()
    expect(onClose).not.toHaveBeenCalled()

    anchor.remove()
  })

  it('renders available roles for government administrators', () => {
    const anchor = createAnchor()
    const onClose = vi.fn()

    render(
      <RoleSwitcher
        currentUser={defaultUser}
        hasRoles={(role) => role === 'Administrator'}
        open
        anchorEl={anchor}
        onClose={onClose}
      />,
      { wrapper }
    )

    expect(screen.getByText('roleSwitcher.title')).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'Analyst' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'Director' })
    ).toBeInTheDocument()

    anchor.remove()
  })

  it('updates user roles when a new role is selected', () => {
    const anchor = createAnchor()
    const onClose = vi.fn()

    render(
      <RoleSwitcher
        currentUser={defaultUser}
        hasRoles={(role) => role === 'Administrator'}
        open
        anchorEl={anchor}
        onClose={onClose}
      />,
      { wrapper }
    )

    const directorRadio = screen.getByRole('radio', { name: 'Director' })
    fireEvent.click(directorRadio)

    expect(mutateMock).toHaveBeenCalledWith({
      userID: 'user123',
      payload: expect.objectContaining({
        userProfileId: 'user123',
        roles: ['administrator', 'director', 'government']
      }),
      meta: {
        admin: true,
        role: 'director'
      }
    })

    anchor.remove()
  })

  it('invokes onClose after a successful role update', () => {
    const anchor = createAnchor()
    const onClose = vi.fn()

    render(
      <RoleSwitcher
        currentUser={defaultUser}
        hasRoles={(role) => role === 'Administrator'}
        open
        anchorEl={anchor}
        onClose={onClose}
      />,
      { wrapper }
    )

    const directorRadio = screen.getByRole('radio', { name: 'Director' })
    fireEvent.click(directorRadio)

    expect(hookOptions).toBeDefined()
    act(() => {
      hookOptions.onSuccess(
        {},
        {
          meta: {
            admin: true,
            role: 'director'
          }
        }
      )
    })

    expect(onClose).toHaveBeenCalled()

    anchor.remove()
  })

  it('displays an error when the user profile id is missing', async () => {
    const anchor = createAnchor()
    const onClose = vi.fn()
    const userWithoutId = {
      ...defaultUser,
      userProfileId: null
    }

    render(
      <RoleSwitcher
        currentUser={userWithoutId}
        hasRoles={(role) => role === 'Administrator'}
        open
        anchorEl={anchor}
        onClose={onClose}
      />,
      { wrapper }
    )

    const directorRadio = screen.getByRole('radio', { name: 'Director' })

    act(() => {
      fireEvent.click(directorRadio)
    })

    expect(mutateMock).not.toHaveBeenCalled()
    
    await waitFor(() => {
      expect(
        screen.getByText('common:submitError')
      ).toBeInTheDocument()
    }, { timeout: 3000 })

    anchor.remove()
  })

  it('calls onClose when the user is not a government administrator', () => {
    const anchor = createAnchor()
    const onClose = vi.fn()

    render(
      <RoleSwitcher
        currentUser={defaultUser}
        hasRoles={() => false}
        open
        anchorEl={anchor}
        onClose={onClose}
      />,
      { wrapper }
    )

    expect(onClose).toHaveBeenCalled()
    expect(
      screen.queryByText('roleSwitcher.title')
    ).not.toBeInTheDocument()

    anchor.remove()
  })
})
