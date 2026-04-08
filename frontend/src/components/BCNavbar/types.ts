import type { ReactElement, ReactNode } from 'react'

export type NavbarRoute = {
  icon?: ReactNode | string
  name: string
  route: string
  hide?: boolean
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
