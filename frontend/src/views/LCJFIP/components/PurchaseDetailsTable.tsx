import Checkbox from '@mui/material/Checkbox'
import FormHelperText from '@mui/material/FormHelperText'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import ErrorIcon from '@mui/icons-material/Error'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { format, isValid, parseISO } from 'date-fns'
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import type { LCJFIPOption } from '@/hooks/useLCJFIP'
import {
  emptyPurchaseRow,
  pricePremiumProblem,
  type LCJFIPFormValues
} from '../lcjfipForm'
import { NumberField } from './fields'

const DATE_FORMAT = 'yyyy-MM-dd'

const toDate = (value: string | null) => {
  if (!value) return null
  const date = parseISO(value)
  return isValid(date) ? date : null
}

const COLUMNS = [
  { key: 'estimatedVolume', required: true, minWidth: 170 },
  { key: 'anticipatedDeliveryDate', required: true, minWidth: 190 },
  { key: 'feedstockSources', required: false, minWidth: 230 },
  { key: 'estimatedBlendPercentage', required: false, minWidth: 130 },
  { key: 'assumedJetAPrice', required: true, minWidth: 150 },
  { key: 'pricePremiumFrom', required: true, minWidth: 170 },
  { key: 'pricePremiumTo', required: true, minWidth: 170 },
  { key: 'pricePremiumValidation', required: false, minWidth: 170 }
] as const

const PremiumStatus = ({
  index,
  maxPremiumRange
}: {
  index: number
  maxPremiumRange: number
}) => {
  const { t } = useTranslation(['lcjfip'])
  const [from, to] = useWatch<LCJFIPFormValues>({
    name: [
      `purchaseDetails.${index}.pricePremiumFrom`,
      `purchaseDetails.${index}.pricePremiumTo`
    ] as const
  }) as [number | null, number | null]

  if (from === null || from === undefined || to === null || to === undefined) {
    return (
      <BCTypography variant="body2" color="text.secondary">
        {t('lcjfip:purchase.premiumIncomplete')}
      </BCTypography>
    )
  }
  const problem = pricePremiumProblem(from, to, maxPremiumRange)
  return (
    <BCBox
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
      role="status"
      data-test={`lcjfip-premium-status-${index}`}
    >
      {problem ? (
        <ErrorIcon fontSize="small" color="error" aria-hidden="true" />
      ) : (
        <CheckCircleIcon fontSize="small" color="success" aria-hidden="true" />
      )}
      <BCTypography variant="body2" color={problem ? 'error' : 'text.primary'}>
        {problem === 'order'
          ? t('lcjfip:validation.premiumOrder')
          : problem === 'range'
            ? t('lcjfip:validation.premiumRange')
            : t('lcjfip:purchase.premiumValid')}
      </BCTypography>
    </BCBox>
  )
}

export const PurchaseDetailsTable = ({
  feedstockSources,
  maxPremiumRange,
  readOnly
}: {
  feedstockSources: LCJFIPOption[]
  maxPremiumRange: number
  readOnly: boolean
}) => {
  const { t } = useTranslation(['lcjfip'])
  const {
    control,
    formState: { errors }
  } = useFormContext<LCJFIPFormValues>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'purchaseDetails',
    keyName: 'fieldKey'
  })

  const header = (key: string) => t(`lcjfip:purchase.${key}`)
  const cellLabel = (key: string, index: number) =>
    t('lcjfip:purchase.rowLabel', { field: header(key), row: index + 1 })
  const rowsError =
    (
      errors.purchaseDetails as {
        message?: string
        root?: { message?: string }
      }
    )?.message ??
    (errors.purchaseDetails as { root?: { message?: string } })?.root?.message
  const feedstockName = (id: number) =>
    feedstockSources.find((source) => source.id === id)?.name ?? ''

  return (
    <section aria-labelledby="lcjfip-purchase-heading">
      <BCTypography
        id="lcjfip-purchase-heading"
        variant="h6"
        component="h3"
        color="primary"
        mb={1}
      >
        {t('lcjfip:purchase.heading')}
      </BCTypography>
      <BCTypography variant="body2" mb={2}>
        {t('lcjfip:purchase.intro')}
      </BCTypography>

      <TableContainer
        tabIndex={0}
        role="region"
        aria-label={t('lcjfip:purchase.tableLabel')}
        sx={{ border: 1, borderColor: 'grey.300', borderRadius: 1 }}
      >
        <Table size="small" aria-label={t('lcjfip:purchase.tableLabel')}>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'grey.100' }}>
              {!readOnly && (
                <TableCell sx={{ fontWeight: 600, width: 64 }}>
                  {header('action')}
                </TableCell>
              )}
              {COLUMNS.map((column) => (
                <TableCell
                  key={column.key}
                  sx={{ fontWeight: 600, minWidth: column.minWidth }}
                >
                  {header(column.key)}
                  {column.required && !readOnly && ` ${t('lcjfip:required')}`}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1}>
                  <BCTypography variant="body2" color="text.secondary">
                    {t('lcjfip:purchase.noRows')}
                  </BCTypography>
                </TableCell>
              </TableRow>
            )}
            {fields.map((row, index) => (
              <TableRow key={row.fieldKey} sx={{ verticalAlign: 'top' }}>
                {!readOnly && (
                  <TableCell>
                    <IconButton
                      aria-label={t('lcjfip:purchase.deleteRow', {
                        row: index + 1
                      })}
                      onClick={() => remove(index)}
                      color="error"
                      size="small"
                      data-test={`lcjfip-delete-row-${index}`}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
                <TableCell>
                  <NumberField
                    name={`purchaseDetails.${index}.estimatedVolume`}
                    decimalScale={0}
                    disabled={readOnly}
                    inputProps={{
                      'aria-label': cellLabel('estimatedVolume', index)
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Controller
                    name={`purchaseDetails.${index}.anticipatedDeliveryDate`}
                    control={control}
                    render={({ field, fieldState }) => (
                      <DatePicker
                        value={toDate(field.value)}
                        onChange={(date) =>
                          field.onChange(
                            date && isValid(date)
                              ? format(date, DATE_FORMAT)
                              : null
                          )
                        }
                        onClose={field.onBlur}
                        format={DATE_FORMAT}
                        disabled={readOnly}
                        slotProps={{
                          textField: {
                            name: field.name,
                            inputRef: field.ref,
                            onBlur: field.onBlur,
                            size: 'small',
                            fullWidth: true,
                            error: !!fieldState.error,
                            helperText: fieldState.error?.message,
                            inputProps: {
                              'aria-label': cellLabel(
                                'anticipatedDeliveryDate',
                                index
                              ),
                              placeholder: 'YYYY-MM-DD'
                            }
                          }
                        }}
                      />
                    )}
                  />
                </TableCell>
                <TableCell>
                  <Controller
                    name={`purchaseDetails.${index}.feedstockSourceIds`}
                    control={control}
                    render={({ field, fieldState }) => (
                      <>
                        <Select
                          multiple
                          fullWidth
                          size="small"
                          displayEmpty
                          sx={{
                            '& .MuiSelect-select.MuiOutlinedInput-input': {
                              padding: '8.5px 14px !important',
                              minHeight: '1.4375em'
                            }
                          }}
                          value={field.value ?? []}
                          onChange={(event) => {
                            const value = event.target.value
                            field.onChange(
                              typeof value === 'string'
                                ? value.split(',').map(Number)
                                : value
                            )
                          }}
                          onBlur={field.onBlur}
                          inputRef={field.ref}
                          name={field.name}
                          disabled={readOnly}
                          error={!!fieldState.error}
                          inputProps={{
                            'aria-label': cellLabel('feedstockSources', index)
                          }}
                          renderValue={(selected) =>
                            (selected as number[]).length
                              ? (selected as number[])
                                  .map(feedstockName)
                                  .join(', ')
                              : t('lcjfip:applicant.select')
                          }
                          data-test={`lcjfip-feedstock-${index}`}
                        >
                          {feedstockSources.map((source) => (
                            <MenuItem key={source.id} value={source.id}>
                              <Checkbox
                                size="small"
                                checked={(field.value ?? []).includes(
                                  source.id
                                )}
                              />
                              <ListItemText primary={source.name} />
                            </MenuItem>
                          ))}
                        </Select>
                        {fieldState.error && (
                          <FormHelperText error>
                            {fieldState.error.message}
                          </FormHelperText>
                        )}
                      </>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <NumberField
                    name={`purchaseDetails.${index}.estimatedBlendPercentage`}
                    decimalScale={2}
                    thousandSeparator={false}
                    disabled={readOnly}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      )
                    }}
                    inputProps={{
                      'aria-label': cellLabel('estimatedBlendPercentage', index)
                    }}
                  />
                </TableCell>
                {(
                  [
                    'assumedJetAPrice',
                    'pricePremiumFrom',
                    'pricePremiumTo'
                  ] as const
                ).map((key) => (
                  <TableCell key={key}>
                    <NumberField
                      name={`purchaseDetails.${index}.${key}`}
                      decimalScale={4}
                      disabled={readOnly}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">$</InputAdornment>
                        )
                      }}
                      inputProps={{ 'aria-label': cellLabel(key, index) }}
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <PremiumStatus
                    index={index}
                    maxPremiumRange={maxPremiumRange}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {rowsError && (
        <FormHelperText error role="alert" data-test="lcjfip-rows-error">
          {rowsError}
        </FormHelperText>
      )}

      {!readOnly && (
        <BCButton
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => append(emptyPurchaseRow())}
          sx={{ mt: 2 }}
          data-test="lcjfip-add-row"
        >
          {t('lcjfip:purchase.addRow')}
        </BCButton>
      )}

      <BCBox mt={3}>
        <BCTypography variant="body2" sx={{ fontWeight: 700 }}>
          {t('lcjfip:purchase.premiumHeading')}
        </BCTypography>
        <BCTypography variant="body2">
          {t('lcjfip:purchase.premiumText')}
        </BCTypography>
      </BCBox>
    </section>
  )
}
