import Autocomplete from '@mui/material/Autocomplete'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import Grid2 from '@mui/material/Grid2'
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
import { FieldLabel, NumberField } from './fields'

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

const RatesTable = ({ rates }: { rates: LCJFIPIncentiveRate[] }) => {
  const { t } = useTranslation(['lcjfip'])
  const rows = rateRows(rates)
  const cellSx = { border: 1, borderColor: 'grey.400' }
  return (
    <Table
      size="small"
      aria-label={t('lcjfip:incentive.ratesTableLabel')}
      sx={{ width: 'auto', mb: 3, borderCollapse: 'collapse' }}
      data-test="lcjfip-rates-table"
    >
      <TableHead>
        <TableRow sx={{ backgroundColor: 'grey.100' }}>
          <TableCell colSpan={2} sx={{ ...cellSx, fontWeight: 700 }}>
            {t('lcjfip:incentive.ratesHeader')}
          </TableCell>
          <TableCell sx={{ ...cellSx, fontWeight: 700 }}>
            {t('lcjfip:incentive.cashOption')}
          </TableCell>
          <TableCell sx={{ ...cellSx, fontWeight: 700 }}>
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
                sx={{ ...cellSx, fontWeight: 700 }}
              >
                {t('lcjfip:incentive.carbonIntensity')}
              </TableCell>
            )}
            <TableCell component="th" scope="row" sx={cellSx}>
              {row.label}
            </TableCell>
            <TableCell sx={cellSx}>
              {row.cash !== undefined &&
                t('lcjfip:incentive.cashRate', {
                  rate: `$${rateNumber(row.cash)}`
                })}
            </TableCell>
            <TableCell sx={cellSx}>
              {row.credit !== undefined &&
                t('lcjfip:incentive.creditRate', {
                  rate: rateNumber(row.credit)
                })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const ReadOnlyValue = ({
  id,
  label,
  value,
  help,
  required = false
}: {
  id: string
  label: string
  value: string
  help?: string
  required?: boolean
}) => (
  <>
    <FieldLabel htmlFor={id} required={required}>
      {label}
    </FieldLabel>
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
  </>
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
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <>
          <FieldLabel htmlFor={name} required={required}>
            {label}
          </FieldLabel>
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
        </>
      )}
    />
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
            <FormLabel
              id="lcjfip-incentive-option-label"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                mb: 1,
                fontSize: '0.95rem'
              }}
            >
              {t('lcjfip:incentive.preferredOption')}
              {!readOnly && ` ${t('lcjfip:required')}`}
            </FormLabel>
            <RadioGroup
              aria-labelledby="lcjfip-incentive-option-label"
              name={field.name}
              value={field.value === null ? '' : String(field.value)}
              onChange={(event) => field.onChange(Number(event.target.value))}
              onBlur={field.onBlur}
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

      <Grid2 container spacing={2} sx={{ maxWidth: 900 }}>
        <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
          <ReadOnlyValue
            id="lcjfip-total-estimated-volume"
            label={t('lcjfip:incentive.totalEstimatedVolume')}
            value={total === null ? '' : total.toLocaleString('en-CA')}
            help={t('lcjfip:incentive.totalEstimatedVolumeHelp')}
          />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
          <FieldLabel htmlFor="estimatedCarbonIntensity">
            {t('lcjfip:incentive.estimatedCarbonIntensity')}
          </FieldLabel>
          <NumberField
            id="estimatedCarbonIntensity"
            name="estimatedCarbonIntensity"
            decimalScale={2}
            allowNegative
            disabled={readOnly}
          />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
          <FieldLabel htmlFor="requestedIncentiveVolume" required={!readOnly}>
            {t('lcjfip:incentive.requestedIncentiveVolume')}
          </FieldLabel>
          <NumberField
            id="requestedIncentiveVolume"
            name="requestedIncentiveVolume"
            decimalScale={0}
            disabled={readOnly}
          />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
          <Controller
            name="fuelCodeId"
            control={control}
            render={({ field, fieldState }) => (
              <>
                <FieldLabel htmlFor="fuelCodeId">
                  {t('lcjfip:incentive.fuelCode')}
                </FieldLabel>
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
              </>
            )}
          />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
          <ReadOnlyValue
            id="lcjfip-estimated-incentive-amount"
            label={t('lcjfip:incentive.estimatedIncentiveAmount')}
            value={formatIncentiveAmount(
              amount,
              option?.incentiveType,
              (value) => t('lcjfip:incentive.credits', { amount: value })
            )}
            help={
              option &&
              (carbonIntensity === null || carbonIntensity === undefined)
                ? t('lcjfip:incentive.baselineRateHelp')
                : t('lcjfip:incentive.estimatedIncentiveAmountHelp')
            }
          />
        </Grid2>
      </Grid2>

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
          <Grid2 container spacing={2} sx={{ maxWidth: 900 }}>
            <Grid2 size={{ xs: 12, md: 6 }}>
              <Controller
                name="fuelSupplierLegalName"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <FieldLabel
                      htmlFor="fuelSupplierLegalName"
                      required={!readOnly}
                    >
                      {t('lcjfip:fuelSupplier.legalName')}
                    </FieldLabel>
                    <Autocomplete
                      id="fuelSupplierLegalName"
                      freeSolo
                      options={suppliers}
                      getOptionLabel={(o) =>
                        typeof o === 'string' ? o : o.name
                      }
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
                  </>
                )}
              />
            </Grid2>
            <Grid2 size={{ xs: 12, md: 6 }} />
            <Grid2 size={{ xs: 12, md: 4 }}>
              <TextInput
                name="fuelSupplierContactFirstName"
                label={t('lcjfip:fuelSupplier.firstName')}
                required={!readOnly}
                readOnly={readOnly}
              />
            </Grid2>
            <Grid2 size={{ xs: 12, md: 4 }}>
              <TextInput
                name="fuelSupplierContactLastName"
                label={t('lcjfip:fuelSupplier.lastName')}
                required={!readOnly}
                readOnly={readOnly}
              />
            </Grid2>
            <Grid2 size={{ xs: 12, md: 4 }}>
              <TextInput
                name="fuelSupplierContactEmail"
                label={t('lcjfip:fuelSupplier.email')}
                required={!readOnly}
                readOnly={readOnly}
                type="email"
              />
            </Grid2>
          </Grid2>
        </section>
      )}
    </section>
  )
}
