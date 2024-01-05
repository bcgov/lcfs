import Pencil from '@/assets/icons/pencil.svg?react'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { ROUTES } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import colors from '@/themes/base/colors.js'
import { constructAddress } from '@/utils/constructAddress'
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model'
import { ModuleRegistry } from '@ag-grid-community/core'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-alpine.css'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Paper } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const dummy = {
  user: {
    isGov: false
  },

  users: [
    {
      display_name: 'Hank Hill',
      roles: [
        {
          name: 'Manage Users'
        },
        {
          name: 'Transfers'
        },
        {
          name: 'Compliance Reporting'
        }
      ],
      email: 'hhill@fscl.ca',
      phone: '(778) 123-0987',
      is_active: true
    },
    {
      display_name: 'Dale Bug',
      roles: [
        {
          name: 'Signing Authority'
        }
      ],
      email: 'dbug@fscl.ca',
      phone: '(778) 123-0988',
      is_active: true
    },
    {
      display_name: 'Gavin MacAuditor',
      roles: [
        {
          name: 'Read Only'
        }
      ],
      email: 'gmaca@fscl.ca',
      phone: '(778) 123-0989',
      is_active: true
    },
    {
      display_name: 'Beau Lawyerson',
      roles: [
        {
          name: 'Read Only'
        }
      ],
      email: 'blaw@fscl.ca',
      phone: '(778) 123-0980',
      is_active: true
    },
    {
      display_name: 'Dale Bug2',
      roles: [
        {
          name: 'Signing Authority'
        }
      ],
      email: 'dbug@fscl.ca',
      phone: '(778) 123-0988',
      is_active: false
    },
    {
      display_name: 'Hank Hill',
      roles: [
        {
          name: 'Manage Users'
        },
        {
          name: 'Transfers'
        },
        {
          name: 'Compliance Reporting'
        }
      ],
      email: 'hhill@fscl.ca',
      phone: '(778) 123-0987',
      is_active: false
    },
    {
      display_name: 'Beau Lawyerson',
      roles: [
        {
          name: 'Read Only'
        }
      ],
      email: 'blaw@fscl.ca',
      phone: '(778) 123-0980',
      is_active: false
    },
    {
      display_name: 'Gavin MacAuditor',
      roles: [
        {
          name: 'Read Only'
        }
      ],
      email: 'gmaca@fscl.ca',
      phone: '(778) 123-0989',
      is_active: false
    }
  ]
}

ModuleRegistry.registerModules([ClientSideRowModelModule])

const OrgDetailTypography = ({ bold, children, ...rest }) => {
  return (
    <BCTypography fontSize={16} fontWeight={bold && 'bold'} {...rest}>
      {children}
    </BCTypography>
  )
}

export const ViewOrg = () => {
  const [showActive, setShowActive] = useState(true)
  const navigate = useNavigate()
  const { orgID } = useParams()
  const client = useApiService()

  const { data: orgData, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: async () => (await client.get(`/organizations/${orgID}`)).data
  })

  if (isLoading) {
    return <Loading />
  }

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
        {orgData.name}{' '}
        <span>
          <Pencil />
        </span>
      </BCTypography>
      <BCBox p={3} bgColor={colors.background.grey}>
        <BCBox display="flex" gap={10}>
          <BCBox
            display="grid"
            gridTemplateColumns="auto auto"
            gap={1}
            alignItems="end"
          >
            <OrgDetailTypography bold>
              Legal name of organization:
            </OrgDetailTypography>
            <OrgDetailTypography>{orgData.name}</OrgDetailTypography>
            <OrgDetailTypography bold>
              Operating name of organization:
            </OrgDetailTypography>
            <OrgDetailTypography>{orgData.name}</OrgDetailTypography>
            <OrgDetailTypography bold>Telephone:</OrgDetailTypography>
            <OrgDetailTypography>{orgData.phone}</OrgDetailTypography>
            <OrgDetailTypography bold>Email:</OrgDetailTypography>
            <OrgDetailTypography>{orgData.email}</OrgDetailTypography>
          </BCBox>
          <BCBox
            display="grid"
            gridTemplateColumns="auto auto"
            gap={1}
            alignItems="end"
          >
            <OrgDetailTypography bold>
              Address for service (postal address):
            </OrgDetailTypography>
            <OrgDetailTypography>
              {constructAddress(orgData.org_address)}
            </OrgDetailTypography>
            <OrgDetailTypography bold>
              Address in B.C. (at which records are maintained):
            </OrgDetailTypography>
            <OrgDetailTypography>
              {constructAddress(orgData.org_attorney_address)}
            </OrgDetailTypography>
            <OrgDetailTypography bold>
              Registered for credit transfers:
            </OrgDetailTypography>
            <OrgDetailTypography>
              {orgData.org_status.status}
            </OrgDetailTypography>
          </BCBox>
        </BCBox>
        {!dummy.user.isGov && (
          <OrgDetailTypography mt={1}>
            Email <a href="mailto:lcfs@gov.bc.ca">lcfs@gov.bc.ca</a> to update
            address information.
          </OrgDetailTypography>
        )}
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
      <AgGridReact
        className="ag-theme-alpine"
        animateRows="true"
        columnDefs={[
          { field: 'display_name', headerName: 'User Name' },
          {
            valueFormatter: (params) =>
              params.data?.roles.map((role) => role.name).join(', '),
            headerName: 'Roles',
            hide: !showActive
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
        rowData={dummy.users.filter((user) => user.is_active === showActive)}
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
