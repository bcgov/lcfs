import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import { DownloadButton } from '@/components/DownloadButton'
import { ROUTES } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box, Typography } from '@mui/material'
import { AgGridReact } from 'ag-grid-react'
import * as dayjs from 'dayjs'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const dummy = {
  // only populated with the fields we need. actually query will probably return the full data.
  transactions: [
    {
      transaction_id: 1,
      compliance_period: '2024',
      transaction_type: {
        type: 'Transfer'
      },
      compliance_units: 123,
      value_per_unit: 123,
      last_updated: '2024-01-04T20:01:40.760Z',
      issuance_history_record: {
        organization: {
          name: 'QuantumNova Fuels'
        },
        issuance_status: {
          status: 'Recorded'
        }
      },
      transfer_history_record: {
        transfer_status: {
          status: 'Recorded'
        },
        from_organization: {
          name: 'NebulaWings Dynamics'
        },
        to_organization: {
          name: 'QuantumNova Fuels'
        }
      }
    },
    {
      transaction_id: 2,
      compliance_period: '2024',
      transaction_type: {
        type: 'Transfer'
      },
      compliance_units: 123,
      value_per_unit: 123,
      last_updated: '2024-01-04T20:01:40.760Z',
      issuance_history_record: {
        organization: {
          name: 'QuantumNova Fuels'
        },
        issuance_status: {
          status: 'Recorded'
        }
      },
      transfer_history_record: {
        transfer_status: {
          status: 'Recorded'
        },
        from_organization: {
          name: 'NebulaWings Dynamics'
        },
        to_organization: {
          name: 'QuantumNova Fuels'
        }
      }
    },
    {
      transaction_id: 3,
      compliance_period: '2024',
      transaction_type: {
        type: 'Transfer'
      },
      compliance_units: 123,
      value_per_unit: 123,
      last_updated: '2024-01-04T20:01:40.760Z',
      issuance_history_record: {
        organization: {
          name: 'QuantumNova Fuels'
        },
        issuance_status: {
          status: 'Recorded'
        }
      },
      transfer_history_record: {
        transfer_status: {
          status: 'Recorded'
        },
        from_organization: {
          name: 'NebulaWings Dynamics'
        },
        to_organization: {
          name: 'QuantumNova Fuels'
        }
      }
    },
    {
      transaction_id: 4,
      compliance_period: '2024',
      transaction_type: {
        type: 'Transfer'
      },
      compliance_units: 123,
      value_per_unit: 123,
      last_updated: '2024-01-04T20:01:40.760Z',
      issuance_history_record: {
        organization: {
          name: 'QuantumNova Fuels'
        },
        issuance_status: {
          status: 'Recorded'
        }
      },
      transfer_history_record: {
        transfer_status: {
          status: 'Recorded'
        },
        from_organization: {
          name: 'NebulaWings Dynamics'
        },
        to_organization: {
          name: 'QuantumNova Fuels'
        }
      }
    },
    {
      transaction_id: 5,
      compliance_period: '2024',
      transaction_type: {
        type: 'Transfer'
      },
      compliance_units: 123,
      value_per_unit: 123,
      last_updated: '2024-01-04T20:01:40.760Z',
      issuance_history_record: {
        organization: {
          name: 'QuantumNova Fuels'
        },
        issuance_status: {
          status: 'Recorded'
        }
      },
      transfer_history_record: {
        transfer_status: {
          status: 'Recorded'
        },
        from_organization: {
          name: 'NebulaWings Dynamics'
        },
        to_organization: {
          name: 'QuantumNova Fuels'
        }
      }
    },
    {
      transaction_id: 6,
      compliance_period: '2024',
      transaction_type: {
        type: 'Transfer'
      },
      compliance_units: 123,
      value_per_unit: 123,
      last_updated: '2024-01-04T20:01:40.760Z',
      issuance_history_record: {
        organization: {
          name: 'QuantumNova Fuels'
        },
        issuance_status: {
          status: 'Recorded'
        }
      },
      transfer_history_record: {
        transfer_status: {
          status: 'Recorded'
        },
        from_organization: {
          name: 'NebulaWings Dynamics'
        },
        to_organization: {
          name: 'QuantumNova Fuels'
        }
      }
    },
    {
      transaction_id: 7,
      compliance_period: '2024',
      transaction_type: {
        type: 'Transfer'
      },
      compliance_units: 123,
      value_per_unit: 123,
      last_updated: '2024-01-04T20:01:40.760Z',
      issuance_history_record: {
        organization: {
          name: 'QuantumNova Fuels'
        },
        issuance_status: {
          status: 'Recorded'
        }
      },
      transfer_history_record: {
        transfer_status: {
          status: 'Recorded'
        },
        from_organization: {
          name: 'NebulaWings Dynamics'
        },
        to_organization: {
          name: 'QuantumNova Fuels'
        }
      }
    },
    {
      transaction_id: 8,
      compliance_period: '2024',
      transaction_type: {
        type: 'Transfer'
      },
      compliance_units: 123,
      value_per_unit: 123,
      last_updated: '2024-01-04T20:01:40.760Z',
      issuance_history_record: {
        organization: {
          name: 'QuantumNova Fuels'
        },
        issuance_status: {
          status: 'Recorded'
        }
      },
      transfer_history_record: {
        transfer_status: {
          status: 'Recorded'
        },
        from_organization: {
          name: 'NebulaWings Dynamics'
        },
        to_organization: {
          name: 'QuantumNova Fuels'
        }
      }
    },
    {
      transaction_id: 9,
      compliance_period: '2024',
      transaction_type: {
        type: 'Transfer'
      },
      compliance_units: 123,
      value_per_unit: 123,
      last_updated: '2024-01-04T20:01:40.760Z',
      issuance_history_record: {
        organization: {
          name: 'QuantumNova Fuels'
        },
        issuance_status: {
          status: 'Recorded'
        }
      },
      transfer_history_record: {
        transfer_status: {
          status: 'Recorded'
        },
        from_organization: {
          name: 'NebulaWings Dynamics'
        },
        to_organization: {
          name: 'QuantumNova Fuels'
        }
      }
    },
    {
      transaction_id: 10,
      compliance_period: '2024',
      transaction_type: {
        type: 'Transfer'
      },
      compliance_units: 123,
      value_per_unit: 123,
      last_updated: '2024-01-04T20:01:40.760Z',
      issuance_history_record: {
        organization: {
          name: 'QuantumNova Fuels'
        },
        issuance_status: {
          status: 'Recorded'
        }
      },
      transfer_history_record: {
        transfer_status: {
          status: 'Recorded'
        },
        from_organization: {
          name: 'NebulaWings Dynamics'
        },
        to_organization: {
          name: 'QuantumNova Fuels'
        }
      }
    }
  ]
}

const getStatus = ({ data }) => {
  switch (data.transaction_type.type) {
    case 'Transfer':
      return data.transfer_history_record.transfer_status.status
    case 'Issuance':
      return data.issuance_history_record.issuance_status.status
    case 'Assessment':
      return ''
    case 'Initiative Agreement':
      return ''
    default:
      break
  }
}

const getOrgnization = ({ data }, type) => {
  switch (data.transaction_type.type) {
    case 'Transfer':
      if (type === 'to') {
        return data.transfer_history_record.to_organization.name
      }
      if (type === 'from') {
        return data.transfer_history_record.from_organization.name
      }
      break
    case 'Issuance':
      if (type === 'to') {
        return data.issuance_history_record.organization.name
      }
      if (type === 'from') {
        return 'BC Gov'
      }
      break
    case 'Assessment':
      return ''
    case 'Initiative Agreement':
      return ''
    default:
      break
  }
}

export const Transactions = () => {
  const navigate = useNavigate()
  const apiService = useApiService()

  const [isDownloadingTransactions, setIsDownloadingTransactions] =
    useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const handleDownloadTransactions = async () => {
    alert('Download Transactions clicked')

    // enable once we have transactions in db

    // setIsDownloadingTransactions(true)
    // setAlertMessage('')
    // try {
    //   await apiService.download('/transactions/export')
    //   isDownloadingTransactions(false)
    // } catch (error) {
    //   console.error('Error downloading organization information:', error)
    //   isDownloadingTransactions(false)
    //   setAlertMessage('Failed to download organization information.')
    //   setAlertSeverity('error')
    // }
  }

  return (
    <>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <Typography variant="h5" mb={2}>
        Transactions
      </Typography>
      <Box display={'flex'} gap={2} mb={2}>
        <BCButton
          variant="contained"
          size="small"
          color="primary"
          startIcon={<FontAwesomeIcon icon={faCirclePlus} />}
          onClick={() => navigate(ROUTES.TRANSACTIONS_ADD)}
        >
          <Typography variant="subtitle2">New Transfer</Typography>
        </BCButton>
        <DownloadButton
          onDownload={handleDownloadTransactions}
          isDownloading={isDownloadingTransactions}
          label="Download as .xls"
          downloadLabel="Downloading Transaction Information..."
          dataTest="download-transactions-button"
        />
      </Box>
      <AgGridReact
        className="ag-theme-alpine"
        animateRows="true"
        columnDefs={[
          { field: 'transaction_id', headerName: 'ID' },
          {
            field: 'compliance_period',
            headerName: 'Compliant period'
          },
          { field: 'transaction_type.type', headerName: 'Type' },
          {
            valueGetter: (data) => getOrgnization(data, 'from'),
            headerName: 'Compliance units from'
          },
          {
            valueGetter: (data) => getOrgnization(data, 'to'),
            headerName: 'Compliance units to'
          },
          { field: 'compliance_units', headerName: 'Number of units' },
          { field: 'value_per_unit', headerName: 'Value per unit' },
          {
            valueGetter: getStatus,
            headerName: 'Status'
          },
          {
            valueFormatter: (data) =>
              dayjs(data.last_updated).format('YYYY-MM-DD'),
            headerName: 'Last updated'
          }
        ]}
        defaultColDef={{
          resizable: true,
          sortable: true,
          filter: true,
          floatingFilter: true
        }}
        rowData={dummy.transactions}
        rowSelection="multiple"
        suppressRowClickSelection="true"
        pagination
        paginationPageSize={5}
        paginationPageSizeSelector={[10, 20, 50, 100]}
        domLayout="autoHeight"
        autoSizeStrategy={{ type: 'fitGridWidth' }}
        // gridOptions={{
        //   suppressPaginationPanel: true
        // }}
      />
      {/* rework BCDataGridServer */}
      {/* move BCPagination into BCDataGrid and conditionally render via a prop */}
      {/* <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint={'transactions'}
          apiData={'transactions'}
          columnDefs={[
            { field: 'transaction_id', headerName: 'ID' },
            {
              field: 'compliance_period',
              headerName: 'Compliant period'
            },
            { field: 'transaction_type.type', headerName: 'Type' },
            {
              valueGetter: (data) => getOrgnization(data, 'from'),
              headerName: 'Compliance units from'
            },
            {
              valueGetter: (data) => getOrgnization(data, 'to'),
              headerName: 'Compliance units to'
            },
            { field: 'compliance_units', headerName: 'Number of units' },
            { field: 'value_per_unit', headerName: 'Value per unit' },
            {
              valueGetter: getStatus,
              headerName: 'Status'
            },
            {
              valueFormatter: (data) =>
                dayjs(data.last_updated).format('YYYY-MM-DD'),
              headerName: 'Last updated'
            }
          ]}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          defaultSortModel={defaultSortModel}
          defaultFilterModel={[
            ...defaultFilterModel,
            {
              filterType: 'number',
              type: 'equals',
              field: 'organization_id',
              filter: orgID
            }
          ]}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
        /> 
        <BCPagination
          page={page}
          size={size}
          total={total}
          handleChangePage={handleChangePage}
          handleChangeRowsPerPage={handleChangeRowsPerPage}
          enableResetButton={enableResetButton}
          enableCopyButton={enableCopyButton}
          gridRef={gridRef}
          rowsPerPageOptions={paginationPageSizeSelector}
        /> */}
    </>
  )
}
