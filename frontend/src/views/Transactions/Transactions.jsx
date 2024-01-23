import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import { DownloadButton } from '@/components/DownloadButton'
import { ROUTES } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box, Typography } from '@mui/material'
import { AgGridReact } from 'ag-grid-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dummy } from './data'
import { gridProps } from './options'

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
          <Typography variant="subtitle2">New Transaction</Typography>
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
