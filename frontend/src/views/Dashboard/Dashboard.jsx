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
    apiService({
      method: 'post',
      url: 'users',
      data: { page: 1, size: 100, sortOrders: [], filters: [] }
    }).then((resp) => {
      return resp.data
    })

  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
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
        <h2>User List</h2>
        <ul>
          {data.data.map((user) => (
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
