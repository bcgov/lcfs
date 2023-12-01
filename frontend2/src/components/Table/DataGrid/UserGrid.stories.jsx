import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { AgGridReact } from 'ag-grid-react'
import UserGrid from './UserGrid'

export default {
  title: 'LCFS/UserGrid',
  component: AgGridReact
}

const Template = () => {
  const rows = [
    { name: 'John', role: 'Admin', email: 'john@example.com', phone: '555-1234', status: 'Active' },
    { name: 'Jane', role: 'Manager', email: 'jane@example.com', phone: '555-5678', status: 'Inactive' },
    { name: 'Bob', role: 'Employee', email: 'bob@example.com', phone: '555-9012', status: 'Active' },
    { name: 'Alice', role: 'Employee', email: 'alice@example.com', phone: '555-3456', status: 'Active' },
    { name: 'David', role: 'Employee', email: 'david@example.com', phone: '555-7890', status: 'Inactive' },
    { name: 'Emily', role: 'Employee', email: 'emily@example.com', phone: '555-2345', status: 'Active' },
    { name: 'Frank', role: 'Employee', email: 'frank@example.com', phone: '555-6789', status: 'Active' },
    { name: 'Grace', role: 'Employee', email: 'grace@example.com', phone: '555-0123', status: 'Inactive' },
    { name: 'Henry', role: 'Employee', email: 'henry@example.com', phone: '555-4567', status: 'Active' },
    { name: 'Isabel', role: 'Employee', email: 'isabel@example.com', phone: '555-8901', status: 'Active' },
    { name: 'Jack', role: 'Employee', email: 'jack@example.com', phone: '555-2346', status: 'Active' }
  ]

  return (
    <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
      <UserGrid rows={rows} />
    </div>
  )
}

export const Default = Template.bind({})
