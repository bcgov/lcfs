import Checkbox from '@mui/material/Checkbox'
import FormHelperText from '@mui/material/FormHelperText'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { format, isValid, parseISO } from 'date-fns'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import type { LCJFIPOption } from '@/hooks/useLCJFIP'
import { pricePremiumProblem, type LCJFIPFormValues } from '../lcjfipForm'
import {
  FieldCell,
  FieldGrid,
  FieldLabel,
  NumberField,
  RequiredLegend
} from './fields'
import { visuallyHidden } from './visuallyHidden'

const DATE_FORMAT = 'yyyy-MM-dd'

// The mock-up has one set of purchase fields. The API and the data model
// keep a list of purchases, so the form edits the first one.
const ROW = 'purchaseDetails.0'

const toDate = (value: string | null) => {
  if (!value) return null
  const date = parseISO(value)
  return isValid(date) ? date : null
}

const fieldId = (key: string) => `lcjfip-purchase-${key}`

// Five fields share the first line on wide screens, as in the mock-up; the
// price premium range takes the second line.
const FIRST_LINE_COLUMNS = {
  xs: 'minmax(0, 1fr)',
  sm: 'repeat(2, minmax(0, 1fr))',
  lg: 'repeat(5, minmax(0, 1fr))'
}
const SECOND_LINE_COLUMNS = {
  xs: 'minmax(0, 1fr)',
  sm: 'repeat(2, minmax(0, 320px))'
}

const selectSx = {
  '& .MuiSelect-select.MuiOutlinedInput-input': {
    padding: '8.5px 14px !important',
    minHeight: '1.4375em'
  }
}

/** Live check of the premium range, announced as it changes. */
const PremiumStatus = ({ maxPremiumRange }: { maxPremiumRange: number }) => {
  const { t } = useTranslation(['lcjfip'])
  const [from, to] = useWatch<LCJFIPFormValues>({
    name: [`${ROW}.pricePremiumFrom`, `${ROW}.pricePremiumTo`] as const
  }) as [number | null, number | null]
  const problem = pricePremiumProblem(from, to, maxPremiumRange)
  return (
    <BCBox role="status" aria-live="polite" data-test="lcjfip-premium-status">
      {problem && (
        <FormHelperText error>
          {problem === 'order'
            ? t('lcjfip:validation.premiumOrder')
            : t('lcjfip:validation.premiumRange')}
        </FormHelperText>
      )}
    </BCBox>
  )
}

export const PurchaseDetails = ({
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
  const blendPercentage = useWatch({
    control,
    name: `${ROW}.estimatedBlendPercentage`
  }) as number | null | undefined

  const label = (key: string) => t(`lcjfip:purchase.${key}`)
  const listError =
    (errors.purchaseDetails as { message?: string })?.message ??
    (errors.purchaseDetails as { root?: { message?: string } })?.root?.message
  const feedstockName = (id: number) =>
    feedstockSources.find((source) => source.id === id)?.name ?? ''
  // The blend ratio reads LCJF:Jet-A, e.g. 30:70; the form stores the LCJF
  // percentage.
  const jetAShare =
    blendPercentage === null || blendPercentage === undefined
      ? null
      : Math.round((100 - blendPercentage) * 100) / 100

  const moneyField = (
    key: 'assumedJetAPrice' | 'pricePremiumFrom' | 'pricePremiumTo'
  ) => (
    <FieldCell
      label={
        <FieldLabel htmlFor={fieldId(key)} required={!readOnly}>
          {label(key)}
        </FieldLabel>
      }
    >
      <NumberField
        id={fieldId(key)}
        name={`${ROW}.${key}`}
        decimalScale={4}
        disabled={readOnly}
        prefix="$"
        inputProps={{ 'data-test': fieldId(key) }}
      />
    </FieldCell>
  )

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
      {!readOnly && <RequiredLegend />}

      <FieldGrid columns={FIRST_LINE_COLUMNS}>
        <FieldCell
          label={
            <FieldLabel
              htmlFor={fieldId('estimatedVolume')}
              required={!readOnly}
            >
              {label('estimatedVolume')}
            </FieldLabel>
          }
        >
          <NumberField
            id={fieldId('estimatedVolume')}
            name={`${ROW}.estimatedVolume`}
            decimalScale={0}
            disabled={readOnly}
            suffix=" L"
            inputProps={{ 'data-test': fieldId('estimatedVolume') }}
          />
        </FieldCell>

        <FieldCell
          label={
            <FieldLabel
              htmlFor={fieldId('anticipatedDeliveryDate')}
              required={!readOnly}
            >
              {label('anticipatedDeliveryDate')}
            </FieldLabel>
          }
        >
          <Controller
            name={`${ROW}.anticipatedDeliveryDate`}
            control={control}
            render={({ field, fieldState }) => (
              <DatePicker
                value={toDate(field.value)}
                onChange={(date) =>
                  field.onChange(
                    date && isValid(date) ? format(date, DATE_FORMAT) : null
                  )
                }
                onClose={field.onBlur}
                format={DATE_FORMAT}
                disabled={readOnly}
                slotProps={{
                  textField: {
                    id: fieldId('anticipatedDeliveryDate'),
                    name: field.name,
                    inputRef: field.ref,
                    onBlur: field.onBlur,
                    size: 'small',
                    fullWidth: true,
                    error: !!fieldState.error,
                    helperText: fieldState.error?.message
                  }
                }}
              />
            )}
          />
        </FieldCell>

        <FieldCell
          label={
            <FieldLabel id={fieldId('feedstockSources-label')}>
              {label('feedstockSources')}
            </FieldLabel>
          }
        >
          <Controller
            name={`${ROW}.feedstockSourceIds`}
            control={control}
            render={({ field, fieldState }) => (
              <>
                <Select
                  multiple
                  fullWidth
                  size="small"
                  displayEmpty
                  labelId={fieldId('feedstockSources-label')}
                  sx={selectSx}
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
                  renderValue={(selected) =>
                    (selected as number[]).length
                      ? (selected as number[]).map(feedstockName).join(', ')
                      : t('lcjfip:applicant.select')
                  }
                  data-test="lcjfip-feedstock"
                >
                  {feedstockSources.map((source) => (
                    <MenuItem key={source.id} value={source.id}>
                      <Checkbox
                        size="small"
                        checked={(field.value ?? []).includes(source.id)}
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
        </FieldCell>

        <FieldCell
          label={
            <FieldLabel htmlFor={fieldId('estimatedBlendPercentage')}>
              {label('estimatedBlendPercentage')}
            </FieldLabel>
          }
        >
          {/* Typing 30 shows 30:70; the Jet-A share follows the value. */}
          <NumberField
            id={fieldId('estimatedBlendPercentage')}
            name={`${ROW}.estimatedBlendPercentage`}
            decimalScale={2}
            thousandSeparator={false}
            disabled={readOnly}
            suffix={jetAShare === null ? undefined : `:${jetAShare}`}
            isAllowed={({ floatValue }) =>
              floatValue === undefined || floatValue <= 100
            }
            inputProps={{
              'aria-describedby': fieldId('estimatedBlendPercentage-help'),
              'data-test': fieldId('estimatedBlendPercentage')
            }}
          />
          <BCBox
            component="span"
            id={fieldId('estimatedBlendPercentage-help')}
            sx={visuallyHidden}
          >
            {t('lcjfip:purchase.blendHelp')}
          </BCBox>
        </FieldCell>

        {moneyField('assumedJetAPrice')}
      </FieldGrid>

      <FieldGrid columns={SECOND_LINE_COLUMNS}>
        {moneyField('pricePremiumFrom')}
        {moneyField('pricePremiumTo')}
      </FieldGrid>
      <PremiumStatus maxPremiumRange={maxPremiumRange} />
      {listError && (
        <FormHelperText error role="alert" data-test="lcjfip-purchase-error">
          {listError}
        </FormHelperText>
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
