import { Outlet } from 'react-router-dom'

const PublicLayout = () => {
  return (
    <>
      <main>
        <Outlet />
      </main>
    </>
  )
}

export default PublicLayout
