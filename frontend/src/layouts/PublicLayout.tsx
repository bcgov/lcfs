import { Outlet, useMatches } from 'react-router-dom'

type RouteHandle = {
  title?: string
}

const PublicLayout = () => {
  const matches = useMatches()
  const lastMatchHandle = matches[matches.length - 1]?.handle as
    | RouteHandle
    | undefined
  const pageTitle = lastMatchHandle?.title || 'LCFS'
  return (
    <>
      <h1 className="visually-hidden">{pageTitle}</h1>
      <Outlet />
    </>
  )
}

export default PublicLayout
