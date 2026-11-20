import Autocomplete from '@mui/material/Autocomplete'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import type {
  LCJFIPFuelCodeOption,
  LCJFIPIncentiveOption,
  LCJFIPIncentiveRate
} from '@/hooks/useLCJFIP'
import {
  estimatedIncentiveAmount,
  formatIncentiveAmount,
  selectMaxRate,
  totalEstimatedVolume,
  type LCJFIPFormValues
} from '../lcjfipForm'
import {
  FieldCell,
  FieldGrid,
  FieldLabel,
  NumberField,
  RequiredLegend
} from './fields'
import { visuallyHidden } from './visuallyHidden'

// The fields keep the mock-up's widths on wide screens: 258, 257 and 293 px
// for the volumes and carbon intensity, 181 and 263 px for the fuel code and
// amount, and 248 px for each fuel supplier field.
const INCENTIVE_COLUMNS = {
  xs: 'minmax(0, 1fr)',
  sm: 'repeat(2, minmax(0, 1fr))',
  md: 'minmax(0, 258fr) minmax(0, 257fr) minmax(0, 293fr)'
}
const INCENTIVE_MAX_WIDTH = 258 + 257 + 293 + 2 * 16
const AMOUNT_COLUMNS = {
  xs: 'minmax(0, 1fr)',
  sm: 'minmax(0, 181fr) minmax(0, 263fr)'
}
const AMOUNT_MAX_WIDTH = 181 + 263 + 16
const SUPPLIER_COLUMNS = {
  xs: 'minmax(0, 1fr)',
  sm: 'repeat(2, minmax(0, 1fr))',
  md: 'repeat(3, minmax(0, 1fr))'
}
const SUPPLIER_MAX_WIDTH = 3 * 248 + 2 * 16

export type SupplierOrganization = { organizationId: number; name: string }

const rateNumber = (value: number) =>
  value.toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  })

/** Rows of the rates table: one per CI band, with its cash and credit rates. */
const rateRows = (rates: LCJFIPIncentiveRate[]) => {
  const rows: {
    key: string
    label: string
    cash?: number
    credit?: number
  }[] = []
  for (const rate of rates) {
    const key = `${rate.ciLowerBound ?? ''}-${rate.ciUpperBound ?? ''}`
    let row = rows.find((existing) => existing.key === key)
    if (!row) {
      row = { key, label: rate.description ?? key }
      rows.push(row)
    }
    if (rate.incentiveType === 'Cash') row.cash = rate.maxRatePerLitre
    else row.credit = rate.maxRatePerLitre
  }
  return rows
}

// The mock-up's rates table: 14 px text, columns of 141, 266, 181 and 181 px
// on wide screens, 63 px rows and a slim header row.
const RATE_COLUMN_WIDTHS = [141, 266, 181, 181]

const RatesTable = ({ rates }: { rates: LCJFIPIncentiveRate[] }) => {
  const { t } = useTranslation(['lcjfip'])
  const rows = rateRows(rates)
  const cellSx = {
    border: 1,
    borderColor: 'grey.400',
    fontSize: '0.875rem',
    lineHeight: 1.4,
    px: 1.5,
    py: 0.5
  }
  const rateCellSx = { ...cellSx, px: 1 }
  const width = (column: number) => ({
    width: { md: RATE_COLUMN_WIDTHS[column] }
  })
  return (
    // On a phone the table is wider than the card, so it scrolls sideways in
    // its own region, which keyboard users can focus to scroll.
    <BCBox
      role="region"
      aria-label={t('lcjfip:incentive.ratesTableLabel')}
      tabIndex={0}
      sx={{ overflowX: 'auto', mb: 3 }}
    >
      <Table
        size="small"
        aria-label={t('lcjfip:incentive.ratesTableLabel')}
        sx={{
          width: 'auto',
          borderCollapse: 'collapse',
          '& tbody tr': { height: 63 }
        }}
        data-test="lcjfip-rates-table"
      >
        <TableHead>
          <TableRow sx={{ backgroundColor: 'grey.100' }}>
            <TableCell
              colSpan={2}
              sx={{
                ...cellSx,
                py: '2px',
                fontWeight: 700,
                textAlign: 'center'
              }}
            >
              {t('lcjfip:incentive.ratesHeader')}
            </TableCell>
            <TableCell sx={{ ...rateCellSx, py: '2px', fontWeight: 700 }}>
              {t('lcjfip:incentive.cashOption')}
            </TableCell>
            <TableCell sx={{ ...rateCellSx, py: '2px', fontWeight: 700 }}>
              {t('lcjfip:incentive.creditOption')}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.key}>
              {index === 0 && (
                <TableCell
                  component="th"
                  scope="rowgroup"
                  rowSpan={rows.length}
                  sx={{
                    ...cellSx,
                    ...width(0),
                    fontWeight: 700,
                    whiteSpace: { md: 'nowrap' }
                  }}
                >
                  {t('lcjfip:incentive.carbonIntensity')}
                </TableCell>
              )}
              <TableCell
                component="th"
                scope="row"
                sx={{ ...cellSx, ...(index === 0 ? width(1) : {}) }}
              >
                {row.label}
              </TableCell>
              <TableCell
                sx={{ ...rateCellSx, ...(index === 0 ? width(2) : {}) }}
              >
                {row.cash !== undefined &&
                  t('lcjfip:incentive.cashRate', {
                    rate: `$${rateNumber(row.cash)}`
                  })}
              </TableCell>
              <TableCell
                sx={{ ...rateCellSx, ...(index === 0 ? width(3) : {}) }}
              >
                {row.credit !== undefined &&
                  t('lcjfip:incentive.creditRate', {
                    rate: rateNumber(row.credit)
                  })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </BCBox>
  )
}

// A calculated value. The mock-up marks it with the required asterisk, but
// nobody types in it, so screen readers are not told it is required.
const ReadOnlyValue = ({
  id,
  label,
  value,
  help,
  marked = false
}: {
  id: string
  label: string
  value: string
  help?: string
  marked?: boolean
}) => (
  <FieldCell
    label={
      <FieldLabel htmlFor={id} marked={marked}>
        {label}
      </FieldLabel>
    }
  >
    <TextField
      id={id}
      value={value}
      size="small"
      fullWidth
      slotProps={{
        input: { readOnly: true },
        htmlInput: { 'data-test': id }
      }}
      helperText={help}
      sx={{ '& .MuiInputBase-root': { backgroundColor: 'grey.100' } }}
    />
  </FieldCell>
)

const TextInput = ({
  name,
  label,
  required,
  readOnly,
  type = 'text'
}: {
  name:
    | 'fuelSupplierContactFirstName'
    | 'fuelSupplierContactLastName'
    | 'fuelSupplierContactEmail'
  label: string
  required: boolean
  readOnly: boolean
  type?: string
}) => {
  const { control } = useFormContext<LCJFIPFormValues>()
  return (
    <FieldCell
      label={
        <FieldLabel htmlFor={name} required={required}>
          {label}
        </FieldLabel>
      }
    >
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            value={field.value ?? ''}
            id={name}
            type={type}
            size="small"
            fullWidth
            disabled={readOnly}
            autoComplete="off"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
          />
        )}
      />
    </FieldCell>
  )
}

export const IncentiveSection = ({
  incentiveOptions,
  rates,
  fuelCodes,
  suppliers,
  readOnly
}: {
  incentiveOptions: LCJFIPIncentiveOption[]
  rates: LCJFIPIncentiveRate[]
  fuelCodes: LCJFIPFuelCodeOption[]
  suppliers: SupplierOrganization[]
  readOnly: boolean
}) => {
  const { t } = useTranslation(['lcjfip'])
  const { control, setValue } = useFormContext<LCJFIPFormValues>()
  const [incentiveOptionId, carbonIntensity, requestedVolume, purchaseDetails] =
    useWatch({
      control,
      name: [
        'incentiveOptionId',
        'estimatedCarbonIntensity',
        'requestedIncentiveVolume',
        'purchaseDetails'
      ]
    })

  const option = incentiveOptions.find((o) => o.id === incentiveOptionId)
  const maxRate = selectMaxRate(rates, option?.incentiveType, carbonIntensity)
  const amount = estimatedIncentiveAmount(requestedVolume, maxRate)
  const total = totalEstimatedVolume(purchaseDetails)
  const showSupplier = !!option?.requiresFuelSupplier

  return (
    <section aria-labelledby="lcjfip-incentive-heading">
      <BCTypography
        id="lcjfip-incentive-heading"
        variant="h6"
        component="h3"
        color="primary"
        mb={2}
      >
        {t('lcjfip:incentive.heading')}
      </BCTypography>

      <RatesTable rates={rates} />

      <Controller
        name="incentiveOptionId"
        control={control}
        render={({ field, fieldState }) => (
          <FormControl error={!!fieldState.error} sx={{ mb: 3 }}>
            {/* Styled as a sub-heading, as in the mock-up; screen readers
                still hear that a choice is required. */}
            <FormLabel
              id="lcjfip-incentive-option-label"
              sx={{
                fontWeight: 700,
                color: 'primary.main',
                mb: 1,
                fontSize: '1rem',
                '&.Mui-focused': { color: 'primary.main' }
              }}
            >
              {t('lcjfip:incentive.preferredOption')}
              {!readOnly && (
                <BCBox component="span" sx={visuallyHidden}>
                  {` ${t('lcjfip:required')}`}
                </BCBox>
              )}
            </FormLabel>
            <RadioGroup
              aria-labelledby="lcjfip-incentive-option-label"
              aria-required={!readOnly}
              name={field.name}
              value={field.value === null ? '' : String(field.value)}
              onChange={(event) => field.onChange(Number(event.target.value))}
              onBlur={field.onBlur}
              // The mock-up indents the options and spaces them 32 px apart.
              sx={{ pl: 1.5, rowGap: 0.75 }}
            >
              {incentiveOptions.map((o, index) => (
                <FormControlLabel
                  key={o.id}
                  value={String(o.id)}
                  control={
                    <Radio
                      size="small"
                      inputRef={index === 0 ? field.ref : undefined}
                    />
                  }
                  label={o.name}
                  disabled={readOnly}
                />
              ))}
            </RadioGroup>
            {fieldState.error && (
              <FormHelperText>{fieldState.error.message}</FormHelperText>
            )}
          </FormControl>
        )}
      />

      {!readOnly && <RequiredLegend />}
      <FieldGrid columns={INCENTIVE_COLUMNS} maxWidth={INCENTIVE_MAX_WIDTH}>
        <ReadOnlyValue
          id="lcjfip-total-estimated-volume"
          label={t('lcjfip:incentive.totalEstimatedVolume')}
          value={
            total === null
              ? ''
              : t('lcjfip:incentive.litres', {
                  amount: total.toLocaleString('en-CA')
                })
          }
          help={t('lcjfip:incentive.totalEstimatedVolumeHelp')}
          marked={!readOnly}
        />
        <FieldCell
          label={
            <FieldLabel htmlFor="estimatedCarbonIntensity">
              {t('lcjfip:incentive.estimatedCarbonIntensity')}
            </FieldLabel>
          }
        >
          <NumberField
            id="estimatedCarbonIntensity"
            name="estimatedCarbonIntensity"
            decimalScale={2}
            fixedDecimalScale
            allowNegative
            disabled={readOnly}
          />
        </FieldCell>
        <FieldCell
          label={
            <FieldLabel htmlFor="requestedIncentiveVolume" required={!readOnly}>
              {t('lcjfip:incentive.requestedIncentiveVolume')}
            </FieldLabel>
          }
        >
          <NumberField
            id="requestedIncentiveVolume"
            name="requestedIncentiveVolume"
            decimalScale={0}
            disabled={readOnly}
            suffix=" L"
          />
        </FieldCell>
      </FieldGrid>
      <FieldGrid columns={AMOUNT_COLUMNS} maxWidth={AMOUNT_MAX_WIDTH}>
        <FieldCell
          label={
            <FieldLabel htmlFor="fuelCodeId">
              {t('lcjfip:incentive.fuelCode')}
            </FieldLabel>
          }
        >
          <Controller
            name="fuelCodeId"
            control={control}
            render={({ field, fieldState }) => (
              <Autocomplete
                id="fuelCodeId"
                options={fuelCodes}
                value={
                  fuelCodes.find((o) => o.fuelCodeId === field.value) ?? null
                }
                getOptionLabel={(o) => o.fuelCode}
                isOptionEqualToValue={(o, v) => o.fuelCodeId === v.fuelCodeId}
                noOptionsText={t('lcjfip:incentive.fuelCodeNoOptions')}
                disabled={readOnly}
                onChange={(_event, selected) => {
                  field.onChange(selected?.fuelCodeId ?? null)
                  if (selected) {
                    setValue(
                      'estimatedCarbonIntensity',
                      selected.carbonIntensity,
                      {
                        shouldDirty: true,
                        shouldValidate: true
                      }
                    )
                  }
                }}
                onBlur={field.onBlur}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    inputRef={field.ref}
                    size="small"
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ??
                      (readOnly
                        ? undefined
                        : t('lcjfip:incentive.fuelCodeHelp'))
                    }
                  />
                )}
              />
            )}
          />
        </FieldCell>
        <ReadOnlyValue
          id="lcjfip-estimated-incentive-amount"
          label={t('lcjfip:incentive.estimatedIncentiveAmount')}
          value={formatIncentiveAmount(
            amount,
            option?.incentiveType,
            (value) => t('lcjfip:incentive.credits', { amount: value }),
            (value) => t('lcjfip:incentive.cad', { amount: value })
          )}
          marked={!readOnly}
          help={
            option &&
            (carbonIntensity === null || carbonIntensity === undefined)
              ? t('lcjfip:incentive.baselineRateHelp')
              : t('lcjfip:incentive.estimatedIncentiveAmountHelp')
          }
        />
      </FieldGrid>

      {showSupplier && (
        <section
          aria-labelledby="lcjfip-supplier-heading"
          style={{ marginTop: 24 }}
          data-test="lcjfip-fuel-supplier"
        >
          <BCTypography
            id="lcjfip-supplier-heading"
            variant="h6"
            component="h4"
            color="primary"
            mb={2}
          >
            {t('lcjfip:fuelSupplier.heading')}
          </BCTypography>
          <FieldGrid columns={SUPPLIER_COLUMNS} maxWidth={SUPPLIER_MAX_WIDTH}>
            <FieldCell
              label={
                <FieldLabel
                  htmlFor="fuelSupplierLegalName"
                  required={!readOnly}
                >
                  {t('lcjfip:fuelSupplier.legalName')}
                </FieldLabel>
              }
            >
              <Controller
                name="fuelSupplierLegalName"
                control={control}
                render={({ field, fieldState }) => (
                  <Autocomplete
                    id="fuelSupplierLegalName"
                    freeSolo
                    options={suppliers}
                    getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
                    inputValue={field.value ?? ''}
                    disabled={readOnly}
                    onInputChange={(_event, value, reason) => {
                      if (reason !== 'input' && reason !== 'clear') return
                      field.onChange(value)
                      // Typing a name unlinks any registered supplier.
                      setValue('fuelSupplierOrganizationId', null, {
                        shouldDirty: true
                      })
                    }}
                    onChange={(_event, selected) => {
                      if (selected && typeof selected !== 'string') {
                        field.onChange(selected.name)
                        setValue(
                          'fuelSupplierOrganizationId',
                          selected.organizationId,
                          { shouldDirty: true }
                        )
                      }
                    }}
                    onBlur={field.onBlur}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        inputRef={field.ref}
                        size="small"
                        error={!!fieldState.error}
                        helperText={
                          fieldState.error?.message ??
                          (readOnly
                            ? undefined
                            : t('lcjfip:fuelSupplier.legalNameHelp'))
                        }
                      />
                    )}
                  />
                )}
              />
            </FieldCell>
          </FieldGrid>
          <FieldGrid columns={SUPPLIER_COLUMNS} maxWidth={SUPPLIER_MAX_WIDTH}>
            <TextInput
              name="fuelSupplierContactFirstName"
              label={t('lcjfip:fuelSupplier.firstName')}
              required={!readOnly}
              readOnly={readOnly}
            />
            <TextInput
              name="fuelSupplierContactLastName"
              label={t('lcjfip:fuelSupplier.lastName')}
              required={!readOnly}
              readOnly={readOnly}
            />
            <TextInput
              name="fuelSupplierContactEmail"
              label={t('lcjfip:fuelSupplier.email')}
              required={!readOnly}
              readOnly={readOnly}
              type="email"
            />
          </FieldGrid>
        </section>
      )}
    </section>
  )
}
