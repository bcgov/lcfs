import { FileSubmissions } from '@/views/FileSubmissions'
import ROUTES from '../routes'
import { Dashboard } from '@/views/Dashboard'

export const miscRoutes = [
  {
    path: ROUTES.FILE_SUBMISSION,
    element: <FileSubmissions />,
    handle: { title: 'File submissions' }
  },
  {
    path: ROUTES.DASHBOARD,
    children: [
      {
        path: '',
        element: <Dashboard />,
        handle: { title: 'Dashboard' }
      }
    ]
  }
]
