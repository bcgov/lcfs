/* eslint-disable react-hooks/exhaustive-deps */
import PropTypes from 'prop-types'
import { useCallback, useState, type ChangeEvent, type MouseEvent } from 'react'
import Pagination from '@mui/material/Pagination'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Replay from '@mui/icons-material/Replay'
import ContentCopy from '@mui/icons-material/ContentCopy'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import BCBox from '@/components/BCBox'
import * as XLSX from 'xlsx'
import { copyToClipboard } from '@/utils/clipboard'
import type { BCGridRef } from '../../types'
import type { ColDef } from 'ag-grid-community'
import type { TablePaginationActionsProps } from '@mui/material/TablePagination/TablePaginationActions'

// MUI forwards this prop to its styled root, although PaginationProps omits it.
const paginationRootProps: { component: 'div' } = { component: 'div' }

export interface BCPaginationActionsProps extends TablePaginationActionsProps {
  enableResetButton?: boolean
  enableCopyButton?: boolean
  enableExportButton?: boolean
  exportName?: string
  gridRef?: BCGridRef
  [key: string]: any
}

export function BCPaginationActions({
  count,
  page,
  rowsPerPage,
  onPageChange,
  enableResetButton,
  enableCopyButton,
  enableExportButton,
  exportName,
  gridRef
}: BCPaginationActionsProps) {
  const [currentPage, setCurrentPage] = useState(page + 1)
  // Reload grid
  const reloadGrid = useCallback(() => {
    gridRef?.current?.api?.resetColumnState()
    gridRef?.current?.api?.setFilterModel(null)
    // TODO: clear custom filters
  }, [gridRef])

  const handleCopyData = useCallback(async () => {
    const selectedRows = gridRef?.current?.api?.getDataAsCsv({
      allColumns: true,
      onlySelected: true,
      skipColumnHeaders: true
    })
    const success = await copyToClipboard(selectedRows as string)
    if (!success) {
      console.error('Failed to copy data to clipboard')
    }
  }, [gridRef])

  const handleDownloadData = useCallback(() => {
    const rows: Record<string, unknown>[] = []
    gridRef?.current?.api?.forEachNodeAfterFilterAndSort((node) => {
      rows.push(node.data as Record<string, unknown>)
    })

    // Get column definitions and create a mapping from field to headerName
    const columnDefs = gridRef?.current?.api?.getColumnDefs() as ColDef[]
    const fieldToHeaderNameMap = columnDefs.reduce<
      Record<string, string | undefined>
    >((map, colDef) => {
      const field = colDef.field
      if (field) map[field] = colDef.headerName
      return map
    }, {})

    // Rename keys in rows using the fieldToHeaderNameMap and format dates
    const renamedRows = rows.map((row) => {
      const renamedRow: Record<string, unknown> = {}
      for (const key in row) {
        const headerName = fieldToHeaderNameMap[key]
        if (headerName) {
          let value = row[key]
          // Check if the value is a date string in ISO format
          if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
            value = value.split('T')[0] // Extract the date part
          }
          renamedRow[headerName] = value
        }
      }
      return renamedRow
    })

    const worksheet = XLSX.utils.json_to_sheet(renamedRows)

    // Adjust column widths
    const colWidths = renamedRows.reduce<number[]>((widths, row) => {
      Object.keys(row).forEach((key, i) => {
        const value = row[key] ? String(row[key]) : ''
        widths[i] = Math.max(widths[i] || 12, value.length)
      })
      return widths
    }, [])

    worksheet['!cols'] = colWidths.map((w) => ({ wch: w }))

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, exportName)

    // Generate file name
    const formattedDate = new Date().toISOString().split('T')[0]
    const fileName = `${(exportName as string)
      .toLowerCase()
      .replace(/\s+/g, '_')}_${formattedDate}.xls`

    // Write file as xls
    XLSX.writeFile(workbook, fileName, { bookType: 'xls', type: 'binary' })
  }, [gridRef, exportName])

  const handlePageChange = useCallback(
    (event: ChangeEvent<unknown>, newPage: number) => {
      if (currentPage === newPage) {
        return
      }
      setCurrentPage(newPage)
      gridRef?.current?.api?.showLoadingOverlay()
      onPageChange(event as MouseEvent<HTMLButtonElement>, newPage - 1)
    },
    [currentPage, gridRef, onPageChange]
  )

  return (
    <BCBox
      sx={{ flexShrink: 0, ml: 2.5, display: 'flex', alignItems: 'center' }}
    >
      <Pagination
        {...paginationRootProps}
        count={Math.ceil(count / rowsPerPage)}
        color="primary"
        page={page + 1}
        showFirstButton
        showLastButton
        onChange={handlePageChange}
      />
      <>
        {enableResetButton && (
          <Tooltip title="Reset sort and filters" placement="top-start">
            <IconButton
              id="reloadGridButton"
              aria-label="reset filters and sorts"
              onClick={reloadGrid}
              color="primary"
            >
              <Replay />
            </IconButton>
          </Tooltip>
        )}
        {enableCopyButton && (
          <Tooltip title="Copy selected rows" placement="top-start">
            <IconButton
              id="copyGridButton"
              aria-label="copy row in csv format"
              onClick={handleCopyData}
              color="primary"
            >
              <ContentCopy />
            </IconButton>
          </Tooltip>
        )}
        {enableExportButton && (
          <Tooltip
            title="Download displayed records to Excel"
            placement="top-start"
          >
            <IconButton
              id="downloadGridButton"
              aria-label="Download displayed records to Excel"
              onClick={handleDownloadData}
              color="primary"
            >
              <FileDownloadOutlined />
            </IconButton>
          </Tooltip>
        )}
      </>
    </BCBox>
  )
}

BCPaginationActions.propTypes = {
  count: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  page: PropTypes.number.isRequired,
  rowsPerPage: PropTypes.number.isRequired,
  handleResetState: PropTypes.func,
  enableExportButton: PropTypes.bool,
  exportName: PropTypes.string
}

BCPaginationActions.displayName = 'BCPaginationActions'
