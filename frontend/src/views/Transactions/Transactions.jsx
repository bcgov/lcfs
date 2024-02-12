import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { DownloadButton } from '@/components/DownloadButton'
import { ROUTES } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box } from '@mui/material'
import { AgGridReact } from 'ag-grid-react'
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { dummy } from './data'
import { gridProps } from './options'
import OrganizationList from './components/OrganizationList'
import { useOrganization } from '@/hooks/useOrganization'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Role } from '@/components/Role'

export const Transactions = () => {
  const navigate = useNavigate()
  const gridRef = useRef()
  const apiService = useApiService()
  const { data: currentUserOrgData } = useOrganization()
  const { data: currentUserData } = useCurrentUser()

  const [isDownloadingTransactions, setIsDownloadingTransactions] =
    useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const handleDownloadTransactions = async () => {
    alert('Download Transactions clicked')

    // enable once we have transactions in db
    // TODO: implement all transactions related backend logic
    // TODO: implement transactions seed

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
      <BCTypography variant="h5" mb={2} color="primary">
        Transactions
      </BCTypography>
      <OrganizationList gridRef={gridRef} />
      <Box display={'flex'} gap={2} mb={2}>
        {currentUserOrgData?.org_status.status === 'Registered' && (
          <Role roles={['Transfer']}>
            <BCButton
              variant="contained"
              size="small"
              color="primary"
              startIcon={<FontAwesomeIcon icon={faCirclePlus} size="2x" />}
              onClick={() => navigate(ROUTES.TRANSFERS_ADD)}
            >
              <BCTypography variant="subtitle2">New transaction</BCTypography>
            </BCButton>
          </Role>
        )}
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
        gridRef={gridRef}
        animateRows="true"
        columnDefs={gridProps.columnDefs}
        defaultColDef={gridProps.defaultColDef}
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
      {/* TODO: once all pieces for data retrieval are in place, we can implement the BCDataGridServer component */}
      {/* <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint={'transactions'}
          apiData={'transactions'}
          columnDefs={columnDefs}
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
