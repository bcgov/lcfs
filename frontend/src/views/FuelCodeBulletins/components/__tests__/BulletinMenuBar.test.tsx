import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import { roles } from '@/constants/roles'
import { BulletinMenuBar } from '../BulletinMenuBar'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'tabs.current': 'Current',
        'tabs.archived': 'Archived',
        'tabs.myFuelCodes': 'My fuel codes'
      }
      return translations[key] || key
    }
  })
}))

let mockHasRolesImpl: (...names: string[]) => boolean = () => false
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: [] },
    hasRoles: (...names: string[]) => mockHasRolesImpl(...names),
    hasAnyRole: (...names: string[]) => mockHasRolesImpl(...names)
  })
}))

describe('BulletinMenuBar', () => {
  beforeEach(() => {
    mockHasRolesImpl = () => false
  })

  it('renders only the public tabs for users without the CI applicant role', () => {
    render(
      <BulletinMenuBar activeTab="current" onTabChange={() => undefined} />,
      { wrapper }
    )

    expect(screen.getByRole('tab', { name: 'Current' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Archived' })).toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'My fuel codes' })
    ).not.toBeInTheDocument()
  })

  it('appends the "My fuel codes" tab for CI applicants', () => {
    mockHasRolesImpl = (...names: string[]) =>
      names.length > 0 && names.every((n) => n === roles.ci_applicant)

    render(
      <BulletinMenuBar activeTab="current" onTabChange={() => undefined} />,
      { wrapper }
    )

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual([
      'My fuel codes',
      'Current',
      'Archived'
    ])
  })

  it('does not surface the tab for adjacent BCeID supplier roles', () => {
    mockHasRolesImpl = (...names: string[]) =>
      names.length > 0 && names.every((n) => n === roles.supplier)

    render(
      <BulletinMenuBar activeTab="current" onTabChange={() => undefined} />,
      { wrapper }
    )

    expect(
      screen.queryByRole('tab', { name: 'My fuel codes' })
    ).not.toBeInTheDocument()
  })

  it('emits the selected tab value via onTabChange when a CI applicant clicks "My fuel codes"', async () => {
    mockHasRolesImpl = (...names: string[]) =>
      names.length > 0 && names.every((n) => n === roles.ci_applicant)

    const onTabChange = vi.fn()
    render(
      <BulletinMenuBar activeTab="current" onTabChange={onTabChange} />,
      { wrapper }
    )

    await userEvent.click(screen.getByRole('tab', { name: 'My fuel codes' }))

    expect(onTabChange).toHaveBeenCalledWith('my')
  })

  it('falls back to the first tab when the active tab is unknown', () => {
    render(
      <BulletinMenuBar activeTab="unknown" onTabChange={() => undefined} />,
      { wrapper }
    )

    const currentTab = screen.getByRole('tab', { name: 'Current' })
    expect(currentTab).toHaveAttribute('aria-selected', 'true')
  })
})
