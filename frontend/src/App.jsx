import { RouterProvider } from 'react-router-dom'
import { useCurrentUser } from './hooks/useCurrentUser'
import Loading from './components/Loading'
import { router } from './routes'

const App = () => {
  const { isLoading } = useCurrentUser()

  if (isLoading) {
    return <Loading />
  }

  return <RouterProvider router={router} />
}

export default App
