import React from 'react'
import { useQuery } from 'react-query'
import Loading from '../../components/Loading'
import useApiService from '../../services/useApiService'
import useUserStore from '../../store/useUserStore'

const testData = async () => {
  const testData = [
    {
      id: 1,
      title: 'Compliance Report 1',
      status: 'Complete',
    },
    {
      id: 2,
      title: 'Compliance Report 2',
      status: 'In Progress',
    },
  ]
  return testData
}

const Dashboard = () => {
  const apiService = useApiService()
  const user = useUserStore((state) => state.user)
  const queryFn = () =>
    apiService.current
      .get(`/users`)
      .then((response) => response.data)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['users'],
    queryFn: queryFn,
    refetchOnWindowFocus: false
  })

  let content = <></>

  if (isLoading) {
    content = <Loading />
  } else if (error) {
    content = (
      <div>
        An error has occurred: {error.message}
      </div>
    )
  } else {
    content = (
      <ul>
      {data.map(report => (
        <li key={report.id}>{report.title} : {report.status}</li>
      ))}
    </ul>
    )
  }

  return (
    <div className="Dashboard">
      <header className="Dashboard-header">
        Dashboard {user && <span>Welcome, {user.username}</span>}
      </header>
      {content}
    </div>
  )
}

export default Dashboard
