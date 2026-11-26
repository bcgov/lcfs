import { useState, useEffect } from 'react'
import {
  currencyFormatter,
  formatNumberWithCommas,
  numberFormatter
} from '@/utils/formatters'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Input from '@mui/material/Input'
import InputAdornment from '@mui/material/InputAdornment'
import CircularProgress from '@mui/material/CircularProgress'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import type { TableContainerProps } from '@mui/material/TableContainer'
import type { SummaryColumn } from '@/types/schema'
import '@mui/material/Tooltip'

type SummaryCellValue = string | number | boolean | null | undefined
interface SummaryRow {
  line?: SummaryCellValue
  format?: string
  bold?: boolean
  [key: string]: SummaryCellValue
}
type TableColumn = SummaryColumn & {
  type?: string
}
interface CellInfo {
  rowIndex: number
  columnId: string
}
interface SummaryTableProps<TRow extends SummaryRow = SummaryRow> extends Omit<
  TableContainerProps,
  'title'
> {
  title?: string
  titleTooltip?: string
  columns: TableColumn[]
  data?: TRow[] | null
  onCellEditStopped?: (data: TRow[], cell: CellInfo) => void
  onBooleanCellEditStopped?: (data: TRow[], cell: CellInfo) => void
  useParenthesis?: boolean
  width?: string
  savingCellKey?: string | null
  tableType?: string
  lines6And8Locked?: boolean
  lines7And9Locked?: boolean
  compliancePeriodYear?: string | number | null
  exemptedLines?: number[]
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
}

const getInputValue = (
  value: SummaryCellValue
): string | number | null | undefined =>
  typeof value === 'boolean' ? Number(value) : value

const SummaryTable = <TRow extends SummaryRow = SummaryRow>({
  title,
  titleTooltip,
  columns,
  data: initialData,
  onCellEditStopped,
  onBooleanCellEditStopped,
  useParenthesis = false,
  width = '100%',
  savingCellKey = null,
  tableType = '',
  lines6And8Locked = false,
  compliancePeriodYear = null,
  exemptedLines = [],
  lines7And9Locked = false,
  inputProps,
  ...props
}: SummaryTableProps<TRow>) => {
  const [data, setData] = useState<TRow[]>(initialData ?? [])
  const [editingCell, setEditingCell] = useState<CellInfo | null>(null)
  const [originalValue, setOriginalValue] = useState<SummaryCellValue>(null)

  const rowFormatters = {
    number: numberFormatter,
    currency: currencyFormatter
  }

  useEffect(() => {
    setData(initialData ?? [])
  }, [initialData])

  const isCellEditable = (rowIndex: number, columnId: string) => {
    const column = columns.find((col) => col.id === columnId)!
    return (
      column.editable &&
      column.editableCells &&
      column.editableCells.includes(rowIndex)
    )
  }

  const isCellLocked = (_rowIndex: number, row: SummaryRow) => {
    const lineNumber = parseInt(String(row.line))
    if (lines7And9Locked && (lineNumber === 7 || lineNumber === 9)) {
      return true
    }
    if (lines6And8Locked && (lineNumber === 6 || lineNumber === 8)) {
      return true
    }
    return false
  }

  /**
   * Checks if a line should be greyed out based on compliance period year.
   * - Lines 12, 13, 14, 16, 19: Grey out for all reports prior to 2024
   * - Lines 17, 22: Additionally grey out for 2022 and prior
   */
  const isLineGreyedByYear = (row: SummaryRow) => {
    if (!compliancePeriodYear) return false
    const year = parseInt(String(compliancePeriodYear))
    const lineNumber = parseInt(String(row.line))

    // Lines 12, 13, 14, 16, 19 - grey out for years before 2024
    if ([12, 13, 14, 16, 19].includes(lineNumber) && year < 2024) {
      return true
    }

    // Lines 17, 22 - grey out for 2022 and prior
    if ([17, 22].includes(lineNumber) && year <= 2022) {
      return true
    }

    return false
  }

  /**
   * Checks if a line should be greyed out due to an exemption.
   */
  const isLineExempted = (row: SummaryRow) => {
    if (!exemptedLines.length) return false
    const lineNumber = parseInt(String(row.line))
    return exemptedLines.includes(lineNumber)
  }

  const getCellConstraints = (
    rowIndex: number,
    columnId: string
  ): { min?: number; max?: number } => {
    const column = columns.find((col) => col.id === columnId)!
    if (column.cellConstraints && column.cellConstraints[rowIndex]) {
      return column.cellConstraints[rowIndex]
    }
    return {}
  }

  const isCellSaving = (rowIndex: number, columnId: string) => {
    if (!savingCellKey) return false
    const expectedKey = `${tableType}_${rowIndex}_${columnId}`
    return savingCellKey === expectedKey
  }

  const handleCellChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    rowIndex: number,
    columnId: string
  ) => {
    const enteredValue = e.target.value
    const constraints = getCellConstraints(rowIndex, columnId)

    // All editable fields are integers
    // If input contains non-numeric chars (like $ or letters), strip decimals immediately
    // If input is purely numeric with decimal, preserve during typing (will be stripped on blur)
    const cleaned = enteredValue.replace(/[^0-9.]/g, '')
    const hasNonNumeric = enteredValue !== cleaned

    let value: string | number
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
    if (
      value !== '' &&
      constraints.max !== undefined &&
      parseInt(String(value)) > constraints.max
    ) {
      value = constraints.max
    }
    if (
      value !== '' &&
      constraints.min !== undefined &&
      parseInt(String(value)) < constraints.min
    ) {
      value = constraints.min
    }

    setData((prevData) => {
      const newData = [...prevData]
      newData[rowIndex] = { ...newData[rowIndex], [columnId]: value }

      // Enforce mutual exclusivity between Line 7 and Line 9
      // Only apply for fuel columns (gasoline, diesel, jetFuel)
      const isFuelColumn = ['gasoline', 'diesel', 'jetFuel'].includes(columnId)
      const currentRow = newData[rowIndex]
      const lineNumber = parseInt(String(currentRow?.line))

      if (isFuelColumn && (lineNumber === 7 || lineNumber === 9)) {
        const numericValue = parseInt(String(value)) || 0

        // If user enters a non-zero value in Line 7, zero out Line 9 in same column
        if (lineNumber === 7 && numericValue !== 0) {
          const line9Index = newData.findIndex(
            (row) => parseInt(String(row?.line)) === 9
          )
          if (line9Index !== -1) {
            newData[line9Index] = { ...newData[line9Index], [columnId]: 0 }
          }
        }

        // If user enters a non-zero value in Line 9, zero out Line 7 in same column
        if (lineNumber === 9 && numericValue !== 0) {
          const line7Index = newData.findIndex(
            (row) => parseInt(String(row?.line)) === 7
          )
          if (line7Index !== -1) {
            newData[line7Index] = { ...newData[line7Index], [columnId]: 0 }
          }
        }
      }

      return newData
    })
    setEditingCell({ rowIndex, columnId })
  }

  const handleBooleanCellChange = (
    rowIndex: number,
    columnId: string,
    value: string
  ) => {
    const booleanValue = value === 'true'
    const newData = data.map((row, index) =>
      index === rowIndex ? { ...row, [columnId]: booleanValue } : row
    )
    setData(newData)
    const cellInfo = { rowIndex, columnId }
    if (onBooleanCellEditStopped) {
      onBooleanCellEditStopped(newData, cellInfo)
    } else {
      onCellEditStopped?.(newData, cellInfo)
    }
  }

  const handleCellFocus = (rowIndex: number, columnId: string) => {
    // Store original value when editing starts
    const currentRow = data[rowIndex]
    if (currentRow) {
      setOriginalValue(currentRow[columnId])
    }
  }

  const saveCellChanges = (rowIndex: number, columnId: string) => {
    if (
      editingCell &&
      editingCell.rowIndex === rowIndex &&
      editingCell.columnId === columnId
    ) {
      const column = columns.find((col) => col.id === columnId)!
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
            currentValue === '' || currentValue === 0
              ? 0
              : parseFloat(String(currentValue)) || 0
          // All editable fields are rounded to integers
          const updatedRow = { ...newData[rowIndex] }
          Reflect.set(updatedRow, columnId, Math.floor(numValue))
          newData[rowIndex] = updatedRow
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
            : parseFloat(String(currentValue)) || 0
          : currentValue

      if (onCellEditStopped && finalValue !== originalValue) {
        const cellInfo = { rowIndex, columnId }
        onCellEditStopped(data, cellInfo)
      }

      setEditingCell(null)
      setOriginalValue(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  const lineNumberTooltip = (
    lineNumber: number,
    isGreyedByYear = false,
    isExempted = false
  ) => {
    if (isExempted) {
      return 'Exempted — not applicable'
    }
    if (isGreyedByYear) {
      return 'Not applicable for this compliance period'
    }
    if (lineNumber === 6 || lineNumber === 8) {
      return 'Locked from assessed snapshot (retained/deferred volumes)'
    }
    if (lineNumber === 7 || lineNumber === 9) {
      return 'Locked from assessed snapshot (previously retained/deferred)'
    }
    return 'Locked from assessed snapshot'
  }

  const handleBlur = (rowIndex: number, columnId: string) => {
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
              {columns.map((column, colIndex) => {
                const isGreyedByYear = isLineGreyedByYear(row)
                const isExempted = isLineExempted(row)
                const isGreyedOrLocked =
                  isCellLocked(rowIndex, row) || isGreyedByYear || isExempted
                const isEditableCell = isCellEditable(rowIndex, column.id)
                return (
                  <TableCell
                    key={column.id}
                    align={
                      column.align === 'center' ||
                      column.align === 'right' ||
                      column.align === 'justify'
                        ? column.align
                        : 'left'
                    }
                    title={
                      isGreyedOrLocked
                        ? lineNumberTooltip(
                            parseInt(String(row.line)),
                            isGreyedByYear,
                            isExempted
                          )
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
                        isGreyedOrLocked &&
                        column.id !== 'line' &&
                        column.id !== 'description'
                          ? '#f5f5f5'
                          : undefined,
                      opacity:
                        isGreyedOrLocked &&
                        column.id !== 'line' &&
                        column.id !== 'description'
                          ? 0.7
                          : 1
                    }}
                  >
                    {column.type === 'booleanRadio' ? (
                      <div style={{ position: 'relative' }}>
                        <RadioGroup
                          row
                          value={
                            row[column.id] === null ||
                            row[column.id] === undefined
                              ? ''
                              : String(row[column.id])
                          }
                          onChange={(event) => {
                            if (!isEditableCell || isGreyedOrLocked) return
                            handleBooleanCellChange(
                              rowIndex,
                              column.id,
                              event.target.value
                            )
                          }}
                          sx={{
                            justifyContent: 'center',
                            flexWrap: 'nowrap',
                            '& .MuiFormControlLabel-root': {
                              mr: 1,
                              whiteSpace: 'nowrap'
                            }
                          }}
                        >
                          <FormControlLabel
                            value="true"
                            control={
                              <Radio
                                size="small"
                                disabled={!isEditableCell || isGreyedOrLocked}
                              />
                            }
                            label="Yes"
                          />
                          <FormControlLabel
                            value="false"
                            control={
                              <Radio
                                size="small"
                                disabled={!isEditableCell || isGreyedOrLocked}
                              />
                            }
                            label="No"
                          />
                        </RadioGroup>
                        {isCellSaving(rowIndex, column.id) && (
                          <CircularProgress
                            size={18}
                            color="primary"
                            sx={{
                              position: 'absolute',
                              right: 2,
                              top: '50%',
                              transform: 'translateY(-50%)'
                            }}
                          />
                        )}
                      </div>
                    ) : isEditableCell && !isCellLocked(rowIndex, row) ? (
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '100%'
                        }}
                      >
                        <Input
                          value={formatNumberWithCommas({
                            value: getInputValue(row[column.id])
                          })}
                          onChange={(e) =>
                            handleCellChange(e, rowIndex, column.id)
                          }
                          onFocus={() => handleCellFocus(rowIndex, column.id)}
                          onBlur={() => handleBlur(rowIndex, column.id)}
                          onKeyDown={handleKeyDown}
                          type="text"
                          inputProps={{
                            inputMode:
                              column.editable &&
                              column.editableCells &&
                              column.editableCells.includes(rowIndex)
                                ? 'decimal'
                                : 'numeric',
                            pattern:
                              column.editable &&
                              column.editableCells &&
                              column.editableCells.includes(rowIndex)
                                ? '[0-9]*\\.?[0-9]*'
                                : '[0-9]*',
                            ...getCellConstraints(rowIndex, column.id),
                            ...inputProps
                          }}
                          startAdornment={
                            column.editable &&
                            column.editableCells &&
                            column.editableCells.includes(rowIndex) &&
                            row.format === 'currency' ? (
                              <InputAdornment position="start">
                                $
                              </InputAdornment>
                            ) : null
                          }
                          endAdornment={null}
                          sx={{
                            width: '100%',
                            height: '100%',
                            padding: '6px',
                            paddingLeft: isCellSaving(rowIndex, column.id)
                              ? column.editable &&
                                column.editableCells &&
                                column.editableCells.includes(rowIndex) &&
                                row.format === 'currency'
                                ? '60px'
                                : '40px'
                              : column.editable &&
                                  column.editableCells &&
                                  column.editableCells.includes(rowIndex) &&
                                  row.format === 'currency'
                                ? '30px'
                                : '6px',
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
                          // Hide values for greyed-out rows (except line number and description)
                          if (
                            (isGreyedByYear || isExempted) &&
                            column.id !== 'line' &&
                            column.id !== 'description'
                          ) {
                            return ''
                          }

                          const rawValue =
                            row[column.id] !== undefined &&
                            row[column.id] !== null
                              ? row[column.id]
                              : 0
                          const shouldFormat =
                            row.format &&
                            colIndex !== 0 &&
                            column.id !== 'description' &&
                            column.id !== 'line' &&
                            column.type !== 'booleanRadio'

                          if (column.type === 'booleanRadio') {
                            return ''
                          }

                          if (shouldFormat && row.format) {
                            const numericValue =
                              typeof rawValue === 'number'
                                ? rawValue
                                : Number(rawValue)

                            const maxDecimals =
                              row.format === 'currency' ? 2 : 0

                            const formatter =
                              rowFormatters[
                                row.format as keyof typeof rowFormatters
                              ]
                            const formattedValue = formatter(
                              Number.isFinite(numericValue) ? numericValue : 0,
                              useParenthesis,
                              maxDecimals
                            )
                            return typeof formattedValue === 'string' ||
                              typeof formattedValue === 'number'
                              ? formattedValue
                              : ''
                          }

                          return typeof rawValue === 'string' ||
                            typeof rawValue === 'number'
                            ? rawValue
                            : null
                        })()}
                      </span>
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default SummaryTable
