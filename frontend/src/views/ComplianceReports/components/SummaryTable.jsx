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
  TextField,
  InputAdornment,
  CircularProgress,
  Tooltip
} from '@mui/material'
import { NumericFormat } from 'react-number-format'

const SummaryTable = ({
  title,
  titleTooltip,
  columns,
  data: initialData,
  onCellEditStopped,
  useParenthesis = false,
  width = '100%',
  savingCellKey = null,
  tableType = '',
  lines6And8Locked = false,
  ...props
}) => {
  const [data, setData] = useState(initialData)
  const [editingCell, setEditingCell] = useState(null)
  const [originalValue, setOriginalValue] = useState(null)

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

  const isCellLocked = (rowIndex, row) => {
    const lineNumber = parseInt(row.line)
    if (props.lines7And9Locked && (lineNumber === 7 || lineNumber === 9)) {
      return true
    }
    if (lines6And8Locked && (lineNumber === 6 || lineNumber === 8)) {
      return true
    }
    return false
  }

  const getCellConstraints = (rowIndex, columnId) => {
    const column = columns.find((col) => col.id === columnId)
    if (column.cellConstraints && column.cellConstraints[rowIndex]) {
      return column.cellConstraints[rowIndex]
    }
    return {}
  }

  const isCellSaving = (rowIndex, columnId) => {
    if (!savingCellKey) return false
    const expectedKey = `${tableType}_${rowIndex}_${columnId}`
    return savingCellKey === expectedKey
  }

  const handleCellChange = (e, rowIndex, columnId) => {
    const enteredValue = e.target.value
    const column = columns.find((col) => col.id === columnId)
    const constraints = getCellConstraints(rowIndex, columnId)
    const row = data[rowIndex]

    // All editable fields are integers
    // If input contains non-numeric chars (like $ or letters), strip decimals immediately
    // If input is purely numeric with decimal, preserve during typing (will be stripped on blur)
    const cleaned = enteredValue.replace(/[^0-9.]/g, '')
    const hasNonNumeric = enteredValue !== cleaned

    let value
    if (hasNonNumeric && cleaned.includes('.')) {
      // Input had non-numeric chars AND decimals - strip decimals immediately
      value = parseInt(cleaned, 10)
      if (isNaN(value)) {
        value = ''
      }
    } else {
      // Input is purely numeric (with optional decimal) - preserve it
      value = cleaned
    }

    // Apply constraints validation
    if (value !== '' && constraints.max !== undefined && parseInt(value) > constraints.max) {
      value = constraints.max
    }
    if (value !== '' && constraints.min !== undefined && parseInt(value) < constraints.min) {
      value = constraints.min
    }

    setData((prevData) => {
      const newData = [...prevData]
      newData[rowIndex] = { ...newData[rowIndex], [columnId]: value }

      // Enforce mutual exclusivity between Line 7 and Line 9
      // Only apply for fuel columns (gasoline, diesel, jetFuel)
      const isFuelColumn = ['gasoline', 'diesel', 'jetFuel'].includes(columnId)
      const currentRow = newData[rowIndex]
      const lineNumber = parseInt(currentRow?.line)

      if (isFuelColumn && (lineNumber === 7 || lineNumber === 9)) {
        const numericValue = parseInt(value) || 0

        // If user enters a non-zero value in Line 7, zero out Line 9 in same column
        if (lineNumber === 7 && numericValue !== 0) {
          const line9Index = newData.findIndex(row => parseInt(row?.line) === 9)
          if (line9Index !== -1) {
            newData[line9Index] = { ...newData[line9Index], [columnId]: 0 }
          }
        }

        // If user enters a non-zero value in Line 9, zero out Line 7 in same column
        if (lineNumber === 9 && numericValue !== 0) {
          const line7Index = newData.findIndex(row => parseInt(row?.line) === 7)
          if (line7Index !== -1) {
            newData[line7Index] = { ...newData[line7Index], [columnId]: 0 }
          }
        }
      }

      return newData
    })
    setEditingCell({ rowIndex, columnId })
  }

  const handleCellFocus = (rowIndex, columnId) => {
    // Store original value when editing starts
    const currentRow = data[rowIndex]
    if (currentRow) {
      setOriginalValue(currentRow[columnId])
    }
  }

  const saveCellChanges = (rowIndex, columnId) => {
    if (
      editingCell &&
      editingCell.rowIndex === rowIndex &&
      editingCell.columnId === columnId
    ) {
      const column = columns.find((col) => col.id === columnId)
      const currentRow = data[rowIndex]
      const currentValue = currentRow[columnId]

      // Convert string values to numbers when saving
      // All editable fields are integers
      if (
        column.editable &&
        column.editableCells &&
        column.editableCells.includes(rowIndex)
      ) {
        setData((prevData) => {
          const newData = [...prevData]
          const numValue =
            currentValue === '' || currentValue === 0 ? 0 : parseFloat(currentValue) || 0
          // All editable fields are rounded to integers
          newData[rowIndex][columnId] = Math.floor(numValue)
          return newData
        })
      }

      // Only call API if value actually changed
      const finalValue =
        column.editable &&
        column.editableCells &&
        column.editableCells.includes(rowIndex)
          ? currentValue === '' || currentValue === 0
            ? 0
            : parseFloat(currentValue) || 0
          : currentValue

      if (onCellEditStopped && finalValue != originalValue) {
        const cellInfo = { rowIndex, columnId }
        onCellEditStopped(data, cellInfo)
      }

      setEditingCell(null)
      setOriginalValue(null)
    }
  }

  const handleKeyDown = (e, rowIndex, columnId) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.target.blur()
    }
  }

  const lineNumberTooltip = (lineNumber) => {
    if (lineNumber === 6 || lineNumber === 8) {
      return 'Locked from assessed snapshot (retained/deferred volumes)'
    }
    if (lineNumber === 7 || lineNumber === 9) {
      return 'Locked from assessed snapshot (previously retained/deferred)'
    }
    return 'Locked from assessed snapshot'
  }

  const handleBlur = (rowIndex, columnId) => {
    saveCellChanges(rowIndex, columnId)
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
                title={index === 0 ? titleTooltip : undefined}
              >
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data?.map((row, rowIndex) => (
            <TableRow
              key={`${row.line ?? 'row'}-${rowIndex}`}
              sx={{
                '&:last-child td, &:last-child th': { borderBottom: 0 },
                backgroundColor: '#fcfcfc'
              }}
            >
              {columns.map((column, colIndex) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  title={
                    isCellLocked(rowIndex, row)
                      ? lineNumberTooltip(parseInt(row.line))
                      : undefined
                  }
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
                    padding: isCellEditable(rowIndex, column.id)
                      ? 0
                      : undefined,
                    backgroundColor:
                      isCellLocked(rowIndex, row) &&
                      column.id !== 'line' &&
                      column.id !== 'description'
                        ? '#f5f5f5'
                        : undefined,
                    opacity:
                      isCellLocked(rowIndex, row) &&
                      column.id !== 'line' &&
                      column.id !== 'description'
                        ? 0.7
                        : 1
                  }}
                >
                  {isCellEditable(rowIndex, column.id) && !isCellLocked(rowIndex, row) ? (
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%'
                      }}
                    >
                      <NumericFormat
                        customInput={TextField}
                        value={row[column.id]}
                        thousandSeparator
                        decimalScale={0}
                        allowNegative={false}
                        onValueChange={(values) => {
                          const syntheticEvent = {
                            target: {
                              value: values.value
                            }
                          }
                          handleCellChange(syntheticEvent, rowIndex, column.id)
                        }}
                        onFocus={() => handleCellFocus(rowIndex, column.id)}
                        onBlur={() => handleBlur(rowIndex, column.id)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, column.id)}
                        slotProps={{
                          input: {
                            startAdornment:
                              row.format === 'currency' ? (
                                <InputAdornment position="start">$</InputAdornment>
                              ) : null
                          },
                          htmlInput: {
                            inputMode: 'numeric',
                            ...getCellConstraints(rowIndex, column.id),
                            ...props.inputProps
                          }
                        }}
                        sx={{
                          width: '100%',
                          height: '100%',
                          '& .MuiOutlinedInput-root': {
                            padding: '6px',
                            paddingLeft: isCellSaving(rowIndex, column.id)
                              ? row.format === 'currency'
                                ? '60px'
                                : '40px'
                              : row.format === 'currency'
                                ? '30px'
                                : '6px',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            backgroundColor: '#fff'
                          },
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #495057'
                          },
                          '& .MuiInputBase-input': {
                            textAlign: column.align || 'left',
                            padding: 0
                          }
                        }}
                        size="small"
                        variant="outlined"
                      />
                      {isCellSaving(rowIndex, column.id) && (
                        <div
                          style={{
                            position: 'absolute',
                            left:
                              column.editable &&
                              column.editableCells &&
                              column.editableCells.includes(rowIndex) &&
                              row.format === 'currency'
                                ? '35px'
                                : '12px', // Adjust for $ sign
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none'
                          }}
                        >
                          <CircularProgress
                            size={18}
                            color="primary"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          />
                        </div>
                      )}
                    </div>
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
                      {(() => {
                        const rawValue =
                          row[column.id] !== undefined &&
                          row[column.id] !== null
                            ? row[column.id]
                            : 0
                        const shouldFormat =
                          row.format &&
                          colIndex !== 0 &&
                          column.id !== 'description' &&
                          column.id !== 'line'

                        if (shouldFormat) {
                          const numericValue =
                            typeof rawValue === 'number'
                              ? rawValue
                              : Number(rawValue)

                          return rowFormatters[row.format](
                            Number.isFinite(numericValue) ? numericValue : 0,
                            useParenthesis,
                            0
                          )
                        }

                        return rawValue
                      })()}
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
