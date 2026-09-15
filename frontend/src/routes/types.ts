import { RouteObject, Location, Params } from 'react-router-dom'

export interface RouteHandle {
  title?: string | ((context: { params: Params; location: Location }) => string)
  crumb?: () => string
  mode?: 'add' | 'edit' | 'view'
  hideBreadcrumb?: boolean
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false
}

export interface AppRouteObject
  extends Omit<RouteObject, 'handle' | 'children'> {
  name?: string
  key?: string
  handle?: RouteHandle
  children?: AppRouteObject[]
}
