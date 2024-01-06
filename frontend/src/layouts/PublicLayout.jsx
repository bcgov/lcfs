import { Outlet, useMatches } from 'react-router-dom'

const PublicLayout = () => {
  const matches = useMatches()
  const pageTitle = matches[matches.length - 1]?.handle?.title || 'LCFS'
  return (
    <>
      <main>
        <h1 className="visually-hidden">{pageTitle}</h1>
        <Outlet />
      </main>
    </>
  )
}

export default PublicLayout
