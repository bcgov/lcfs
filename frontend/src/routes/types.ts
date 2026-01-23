import { ReactNode } from 'react'
import { RouteObject, Location, Params } from 'react-router-dom'

export interface RouteHandle {
  title?: string | ((context: { params: Params; location: Location }) => string)
  crumb?: () => string
  mode?: 'add' | 'edit' | 'view'
}

export interface AppRouteObject extends Omit<RouteObject, 'handle' | 'children'> {
  name?: string
  key?: string
  handle?: RouteHandle
  children?: AppRouteObject[]
}
