import { useQuery } from 'react-query'
import Loading from '@/components/Loading'
import useApiService from '@/services/useApiService'
import useUserStore from '@/store/useUserStore'
import BCeIDBalance from '@/views/dashboard/components/BCeIDBalance'
import IDIRBalance from '@/views/dashboard/components/IDIRBalance'

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

const Dashboard = () => {
  const apiService = useApiService()
  const user = useUserStore((state) => state.user)

  const queryFn = () =>
    apiService.get('/users').then((response) => response.data)

  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn,
    refetchOnWindowFocus: false,
    retry: false
  })

  let content = <></>

  if (isLoading) {
    content = <Loading />
  } else if (error) {
    content = <div>An error has occurred: {error.message}</div>
  } else {
    content = (
      <>
        <h2>User List</h2>
        <ul>
          {data.map((user) => (
            <li key={user.id}>
              {user.display_name} : {user.title}
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

export default Dashboard
