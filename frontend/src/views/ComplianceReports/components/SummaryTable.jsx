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
  Input,
  InputAdornment
} from '@mui/material'

const SummaryTable = ({
  title,
  columns,
  data: initialData,
  onCellEditStopped,
  useParenthesis = false,
  width = '100%',
  ...props
}) => {
  const [data, setData] = useState(initialData)
  const [editingCell, setEditingCell] = useState(null)

  const rowFormatters = {
    number: numberFormatter,
    currency: currencyFormatter
  }

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
    const enteredValue = e.target.value
    const column = columns.find((col) => col.id === columnId)
    const constraints = getCellConstraints(rowIndex, columnId)
    
    let value
    if (column.editable && column.editableCells && column.editableCells.includes(rowIndex)) {
      // For currency inputs (penalty fields), store as string to preserve decimal input
      value = enteredValue.replace(/[^0-9.]/g, '')
    } else {
      // Convert to integer for non-currency fields
      value = enteredValue === '' ? 0 : parseInt(enteredValue.replace(/\D/g, ''), 10)
    }

    // Apply constraints validation
    if (constraints.max !== undefined && parseInt(value) > constraints.max) {
      value = constraints.max
    }
    if (constraints.min !== undefined && parseInt(value) < constraints.min) {
      value = constraints.min
    }

    setData((prevData) => {
      const newData = [...prevData]
      newData[rowIndex] = { ...newData[rowIndex], [columnId]: value }
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
      const column = columns.find((col) => col.id === columnId)
      
      // Convert string values to numbers for currency fields when editing stops
      if (column.editable && column.editableCells && column.editableCells.includes(rowIndex)) {
        setData((prevData) => {
          const newData = [...prevData]
          const currentValue = newData[rowIndex][columnId]
          const numValue = currentValue === '' ? 0 : parseFloat(currentValue) || 0
          // Round to 2 decimal places for currency
          newData[rowIndex][columnId] = Math.round(numValue * 100) / 100
          return newData
        })
      }
      
      if (onCellEditStopped) {
        onCellEditStopped(data)
      }
      setEditingCell(null)
    }
  }
  return (
    <TableContainer
      {...props}
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
                align="center"
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
                    <Input
                      value={
                        column.editable && column.editableCells && column.editableCells.includes(rowIndex)
                          ? row[column.id]
                          : formatNumberWithCommas({
                              value: row[column.id]
                            })
                      }
                      onChange={(e) => handleCellChange(e, rowIndex, column.id)}
                      onBlur={() => handleBlur(rowIndex, column.id)}
                      type="text"
                      inputProps={{
                        inputMode: column.editable && column.editableCells && column.editableCells.includes(rowIndex) ? 'decimal' : 'numeric',
                        pattern: column.editable && column.editableCells && column.editableCells.includes(rowIndex) ? '[0-9]*\\.?[0-9]*' : '[0-9]*',
                        ...getCellConstraints(rowIndex, column.id),
                        ...props.inputProps
                      }}
                      startAdornment={
                        column.editable && column.editableCells && column.editableCells.includes(rowIndex) && row.format === 'currency' ? (
                          <InputAdornment position="start">$</InputAdornment>
                        ) : null
                      }
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
                  ) : (
                    <span
                      style={{
                        fontWeight:
                          column.bold ||
                          (column.id === 'description' && !row.line) ||
                          row.bold
                            ? 'bold'
                            : 'normal',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block'
                      }}
                    >
                      {row.format && colIndex !== 0
                        ? rowFormatters[row.format](
                            row[column.id],
                            useParenthesis,
                            0
                          )
                        : row[column.id]}
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
