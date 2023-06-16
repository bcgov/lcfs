import { useQuery } from 'react-query'
import Loading from '../components/Loading'
import useAxios from '../utils/axiosHook'

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
  const axiosInstance = useAxios()

  const queryFn = () =>
    axiosInstance.current
      .get(`/api/compliance_reports`)
      .then((response) => response.data)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['compliance-reports'],
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
        Dashboard
      </header>
      {content}
    </div>
  )
}

export default Dashboard
