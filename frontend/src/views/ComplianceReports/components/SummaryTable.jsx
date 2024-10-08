import { useState, useEffect } from 'react'
import {
  currencyFormatter,
  formatNumberWithCommas,
  numberFormatter
} from '@/utils/formatters'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Input
} from '@mui/material'

const SummaryTable = ({
  title,
  columns,
  data: initialData,
  onCellEditStopped,
  width = '100%',
  ...props
}) => {
  const [data, setData] = useState(initialData)
  const [editingCell, setEditingCell] = useState(null)

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  const isCellEditable = (rowIndex, columnId) => {
    const column = columns.find((col) => col.id === columnId)
    return (
      column.editable &&
      column.editableCells &&
      column.editableCells.includes(rowIndex)
    )
  }

  const getCellConstraints = (rowIndex, columnId) => {
    const column = columns.find((col) => col.id === columnId)
    if (column.cellConstraints && column.cellConstraints[rowIndex]) {
      return column.cellConstraints[rowIndex]
    }
    return {}
  }

  const handleCellChange = (e, rowIndex, columnId) => {
    let newValue = e.target.value

    // Remove any non-digit characters
    newValue = newValue.replace(/\D/g, '')

    // Convert to number
    const numValue = newValue === '' ? '' : parseInt(newValue, 10)

    // Check min and max constraints
    const { min, max } = getCellConstraints(rowIndex, columnId)
    if (numValue !== '') {
      if (min !== undefined && numValue < min) {
        newValue = min
      } else if (max !== undefined && numValue > max) {
        newValue = max
      } else {
        newValue = numValue
      }
    }

    setData((prevData) => {
      const newData = [...prevData]
      newData[rowIndex] = { ...newData[rowIndex], [columnId]: newValue }
      return newData
    })
    setEditingCell({ rowIndex, columnId })
  }
  // Cell editing has stopped perform autosave
  const handleBlur = (rowIndex, columnId) => {
    if (
      editingCell &&
      editingCell.rowIndex === rowIndex &&
      editingCell.columnId === columnId
    ) {
      if (onCellEditStopped) {
        onCellEditStopped(data)
      }
      setEditingCell(null)
    }
  }
  return (
    <TableContainer
      component={Paper}
      sx={{ margin: '20px 0', border: '1px solid #495057', width }}
    >
      <Table
        sx={{ minWidth: 650, borderCollapse: 'separate', borderSpacing: 0 }}
        aria-label={`${title} table`}
      >
        <TableHead>
          <TableRow>
            {columns.map((column, index) => (
              <TableCell
                key={column.id}
                align={column.align || 'center'}
                sx={{
                  fontWeight: 'bold',
                  backgroundColor: '#f0f0f0',
                  borderBottom: '2px solid #495057',
                  borderRight:
                    index < columns.length - 1 ? '1px solid #495057' : 'none',
                  maxWidth: column.maxWidth || 'none',
                  width: column.width || 'auto',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data?.map((row, rowIndex) => (
            <TableRow
              key={row.line}
              sx={{
                '&:last-child td, &:last-child th': { borderBottom: 0 },
                backgroundColor: '#fcfcfc'
              }}
            >
              {columns.map((column, colIndex) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  sx={{
                    borderBottom:
                      rowIndex === data.length - 1
                        ? 'none'
                        : '1px solid #495057',
                    borderRight:
                      colIndex < columns.length - 1
                        ? '1px solid #495057'
                        : 'none',
                    maxWidth: column.maxWidth || 'none',
                    width: column.width || 'auto',
                    padding: isCellEditable(rowIndex, column.id) ? 0 : undefined
                  }}
                >
                  {isCellEditable(rowIndex, column.id) ? (
                    <>
                      <Input
                        value={formatNumberWithCommas({
                          value: row[column.id]
                        })}
                        onChange={(e) =>
                          handleCellChange(e, rowIndex, column.id)
                        }
                        onBlur={() => handleBlur(rowIndex, column.id)}
                        type="text"
                        inputProps={{
                          inputMode: 'numeric',
                          pattern: '[0-9]*',
                          ...getCellConstraints(rowIndex, column.id),
                          ...props.inputProps
                        }}
                        sx={{
                          width: '100%',
                          height: '100%',
                          padding: '6px',
                          borderRadius: '8px',
                          fontSize: '1rem',
                          border: '1px solid #495057',
                          backgroundColor: '#fff',
                          '& .MuiInputBase-input': {
                            textAlign: column.align || 'left'
                          }
                        }}
                        disableUnderline
                      />
                    </>
                  ) : (
                    <span
                      style={{
                        fontWeight:
                          column.bold ||
                          (column.id === 'description' && !row.line)
                            ? 'bold'
                            : 'normal',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block'
                      }}
                    >
                      {row?.format &&
                      (row[column.id] || row[column.id] === 0) &&
                      row.format === 'currency'
                        ? currencyFormatter(row[column.id])
                        : numberFormatter(row[column.id], true)}
                    </span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default SummaryTable
