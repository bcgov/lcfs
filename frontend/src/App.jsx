import { RouterProvider, createBrowserRouter } from 'react-router-dom'

import { routes } from '@/routes'

const router = createBrowserRouter(routes)

const App = () => <RouterProvider router={router} />

export default App
