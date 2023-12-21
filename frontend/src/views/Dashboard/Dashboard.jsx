import Loading from '@/components/Loading'
import { useApiService } from '@/services/useApiService'
import { useUserStore } from '@/stores/useUserStore'
import BCeIDBalance from './components/BCeIDBalance'
import IDIRBalance from './components/IDIRBalance'
import { useQuery } from 'react-query'

// const testData = async () => {
//   const testData = [
//     {
//       id: 1,
//       title: 'Compliance Report 1',
//       status: 'Complete'
//     },
//     {
//       id: 2,
//       title: 'Compliance Report 2',
//       status: 'In Progress'
//     }
//   ]
//   return testData
// }

export const Dashboard = () => {
  const apiService = useApiService()
  const user = useUserStore((state) => state.user)

  const queryFn = () =>
    // temp test
    apiService.get('/organizations/list').then((response) => response.data)

  const { data, isLoading, error } = useQuery({
    queryKey: ['organizations'],
    queryFn,
    refetchOnWindowFocus: false
  })

  let content = <></>

  if (isLoading) {
    content = <Loading />
  } else if (error) {
    content = <div>An error has occurred: {error.message}</div>
  } else {
    content = (
      <>
        <h2>Organization List</h2>
        <ul>
          {data.map((organization) => (
            <li key={organization.organization_id}>
              {organization.name} : {organization.edrms_record}
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <div className="Dashboard">
      <header className="Dashboard-header">
        Dashboard {user && <span>Welcome, {user.username}</span>}
      </header>
      {content}
      <div className="Dashboard-components">
        <BCeIDBalance />
        <IDIRBalance />
      </div>
    </div>
  )
}
