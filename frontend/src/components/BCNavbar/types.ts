import type { ReactElement, ReactNode } from 'react'

export type NavbarRoute = {
  icon?: ReactNode | string
  name: string
  route: string
  hide?: boolean
  /**
   * Additional path prefixes that should keep this nav item highlighted as
   * the active link. Useful when a single top-level nav entry owns several
   * sibling routes (e.g. "Fuel codes" covering /fuel-codes-bulletins,
   * /fuel-codes, and /ci-applications).
   */
  activePaths?: string[]
}

export type NavbarInjectedComponent = ReactElement | null

export interface NavbarContextData {
  title: string
  routes: NavbarRoute[]
  beta: boolean
  headerRightPart?: NavbarInjectedComponent
  menuRightPart?: NavbarInjectedComponent
}

export interface BCNavbarProps {
  title?: string
  routes?: NavbarRoute[]
  beta?: boolean
  headerRightPart?: NavbarInjectedComponent
  menuRightPart?: NavbarInjectedComponent
}
