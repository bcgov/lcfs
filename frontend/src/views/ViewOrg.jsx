import Pencil from '@/assets/icons/pencil.svg?react'
import colors from '@/themes/base/colors.js'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { ROUTES } from '@/constants/routes'
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model'
import { ModuleRegistry } from '@ag-grid-community/core'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-alpine.css'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Paper } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from 'react-query'
import { useApiService } from '@/services/useApiService'

const dummy = {
  orgData: {
    legalName: 'Fuel Supplier Canada Ltd.',
    operatingName: 'Green Oil',
    telephone: '(250) 123-4567',
    email: 'greenoil@fscl.ca',
    serviceAddress: '4567 Hughes Road, Vancouver BC CA, C8C 1C1',
    bcAddress: '1234 Linden Street, Vancouver BC CA, V8V 1V1',
    registered: 'Yes — A registered organization is able to transfer credits.'
  },
  tableData: {
    active: [
      {
        userName: 'Hank Hill',
        roles: 'Manage Users, Transfer, Compliance Reporting',
        email: 'hhill@fscl.ca',
        phone: '(778) 123-0987',
        active: true
      },
      {
        userName: 'Dale Bug',
        roles: 'Signing Authority',
        email: 'dbug@fscl.ca',
        phone: '(778) 123-0988',
        active: true
      },
      {
        userName: 'Gavin MacAuditor',
        roles: 'Read Only',
        email: 'gmaca@fscl.ca',
        phone: '(778) 123-0989',
        active: true
      },
      {
        userName: 'Beau Lawyerson',
        roles: 'Read Only',
        email: 'blaw@fscl.ca',
        phone: '(778) 123-0980',
        active: true
      }
    ],
    inactive: [
      {
        userName: 'Dale Bug2',
        roles: 'Signing Authority',
        email: 'dbug@fscl.ca',
        phone: '(778) 123-0988',
        active: false
      },
      {
        userName: 'Hank Hill',
        roles: 'Manage Users, Transfer, Compliance Reporting',
        email: 'hhill@fscl.ca',
        phone: '(778) 123-0987',
        active: false
      },
      {
        userName: 'Beau Lawyerson',
        roles: 'Read Only',
        email: 'blaw@fscl.ca',
        phone: '(778) 123-0980',
        active: false
      },
      {
        userName: 'Gavin MacAuditor',
        roles: 'Read Only',
        email: 'gmaca@fscl.ca',
        phone: '(778) 123-0989',
        active: false
      }
    ]
  }
}

ModuleRegistry.registerModules([ClientSideRowModelModule])

const OrgDetailType = ({ bold, children }) => {
  return (
    <BCTypography fontSize={16} fontWeight={bold && 'bold'}>
      {children}
    </BCTypography>
  )
}

export const ViewOrg = () => {
  const [showActive, setShowActive] = useState(true)
  const navigate = useNavigate()
  const { orgID } = useParams()
  const client = useApiService()

  const { data: orgData } = useQuery({
    queryKey: ['organization'],
    queryFn: async () => await client.get(`/organizations/${orgID}`)
  })

  console.log(orgData)

  return (
    <Paper
      elevation={5}
      sx={{
        padding: '1rem',
        position: 'relative',
        minHeight: '80vh',
        bgcolor: 'background.paper'
      }}
    >
      <BCTypography variant="h3">
        Organization{' '}
        <span>
          <Pencil />
        </span>
      </BCTypography>
      <BCBox p={3} bgColor={colors.background.grey} display="flex" gap={10}>
        <BCBox
          display="grid"
          gridTemplateColumns="auto auto"
          gap={1}
          alignItems="end"
        >
          <OrgDetailType bold>Legal name of organization:</OrgDetailType>
          <OrgDetailType>{dummy.orgData.legalName}</OrgDetailType>
          <OrgDetailType bold>Operating name of organization:</OrgDetailType>
          <OrgDetailType>{dummy.orgData.operatingName}</OrgDetailType>
          <OrgDetailType bold>Telephone:</OrgDetailType>
          <OrgDetailType>{dummy.orgData.telephone}</OrgDetailType>
          <OrgDetailType bold>Email:</OrgDetailType>
          <OrgDetailType>{dummy.orgData.email}</OrgDetailType>
        </BCBox>
        <BCBox
          display="grid"
          gridTemplateColumns="auto auto"
          gap={1}
          alignItems="end"
        >
          <OrgDetailType bold>
            Address for service (postal address):
          </OrgDetailType>
          <OrgDetailType>{dummy.orgData.serviceAddress}</OrgDetailType>
          <OrgDetailType bold>
            Address in B.C. (at which records are maintained):
          </OrgDetailType>
          <OrgDetailType>{dummy.orgData.bcAddress}</OrgDetailType>
          <OrgDetailType bold>Registered for credit transfers:</OrgDetailType>
          <OrgDetailType>{dummy.orgData.registered}</OrgDetailType>
        </BCBox>
      </BCBox>
      <BCBox
        sx={{
          display: 'flex',
          flexDirection: 'row', // default layout is row
          flexWrap: 'wrap', // allow items to wrap to the next row
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          textTransform: 'none'
        }}
        my={2}
      >
        {showActive ? (
          <>
            <BCButton
              variant="contained"
              size="large"
              color="primary"
              sx={{
                textTransform: 'none',
                marginRight: '8px',
                marginBottom: '8px'
              }}
              startIcon={<FontAwesomeIcon icon={faCirclePlus} />}
              onClick={() => navigate(ROUTES.ORGANIZATIONS_ADDUSER)}
            >
              <BCTypography variant="subtitle2">New User</BCTypography>
            </BCButton>
            <BCButton
              variant="outlined"
              size="large"
              color="primary"
              sx={{
                textTransform: 'none',
                marginRight: '8px',
                marginBottom: '8px',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setShowActive(false)}
            >
              <BCTypography variant="subtitle2">
                Show Inactive Users
              </BCTypography>
            </BCButton>
          </>
        ) : (
          <BCButton
            variant="outlined"
            size="large"
            color="primary"
            sx={{
              textTransform: 'none',
              marginRight: '8px',
              marginBottom: '8px',
              whiteSpace: 'nowrap'
            }}
            onClick={() => setShowActive(true)}
          >
            <BCTypography variant="subtitle2">Show Active Users</BCTypography>
          </BCButton>
        )}
      </BCBox>
      asd
      <AgGridReact
        className="ag-theme-alpine"
        animateRows="true"
        columnDefs={[
          { field: 'userName', headerName: 'User Name' },
          {
            field: 'roles',
            headerName: 'Roles'
          },
          {
            field: 'email',
            headerName: 'Email'
          },
          { field: 'phone', headerName: 'Phone' }
        ]}
        defaultColDef={{
          resizable: true,
          sortable: true,
          filter: true,
          floatingFilter: true
        }}
        rowData={dummy.tableData[showActive ? 'active' : 'inactive']}
        rowSelection="multiple"
        suppressRowClickSelection="true"
        pagination
        paginationPageSize={10}
        paginationPageSizeSelector={[10, 20, 50, 100]}
        domLayout="autoHeight"
        autoSizeStrategy={{ type: 'fitGridWidth' }}
      />
    </Paper>
  )
}
