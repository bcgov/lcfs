import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import {
  Box,
  Grid,
  TextField,
  MenuItem,
  InputLabel,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Checkbox,
  Radio,
  RadioGroup
} from '@mui/material'
import { CheckCircleOutline as CheckCircleOutlineIcon, PictureAsPdf as PictureAsPdfIcon } from '@mui/icons-material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import { useFormExport } from '../hooks/useFormExport'

// ── Options ───────────────────────────────────────────────────────────────────

const FUEL_TYPES = [
  'Biodiesel',
  'Ethanol',
  'Hydrogen',
  'Propane',
  'Renewable natural gas',
  'Electricity',
  'Hydrogenation-derived renewable diesel',
  'Other'
]

const REPORTING_PERIODS = Array.from({ length: 6 }, (_, i) => {
  const year = new Date().getFullYear() - i
  return { value: String(year), label: String(year) }
})

// ── Validation ────────────────────────────────────────────────────────────────

const schema = yup.object({
  reporting_period: yup.string().required('Required'),
  declaration_type: yup.string().oneOf(['Full', 'Partial', 'Amended']).required('Required'),
  contact_name:     yup.string().required('Required'),
  contact_email:    yup.string().email('Invalid email').required('Required'),
  fuel_type:        yup.string().required('Required'),
  quantity:         yup.number().typeError('Must be a number').positive('Must be > 0').required('Required'),
  units:            yup.string().required('Required'),
  notes:            yup.string(),
  certified:        yup.boolean().oneOf([true], 'You must certify before exporting')
})

const DEFAULT_VALUES = {
  reporting_period: String(new Date().getFullYear() - 1),
  declaration_type: 'Full',
  contact_name:     'Jane Smith',
  contact_email:    'compliance@bcfuels.ca',
  fuel_type:        'Biodiesel',
  quantity:         150000,
  units:            'L',
  notes:            'Fuel supplied to commercial fleet operators in the Lower Mainland region.',
  certified:        true
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FuelSupplierDeclaration({ formMeta, formSlug, linkKey }) {
  const { exportForm, downloading, downloadSuccess } = useFormExport({
    formSlug,
    linkKey,
    organizationName: formMeta?.organization_name
  })

  const { control, handleSubmit, register, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: DEFAULT_VALUES
  })

  return (
    <Box
      component="form"
      onSubmit={handleSubmit((values) => exportForm(values, 'docx'))}
      noValidate
    >
      <Grid container spacing={3}>

        {/* ── Organization (read-only) ──────────────────────────────────── */}
        <Grid item xs={12}>
          <InputLabel sx={{ mb: 0.5, fontWeight: 500 }}>Organization</InputLabel>
          <TextField
            fullWidth
            size="small"
            disabled
            value={formMeta?.organization_name || ''}
          />
        </Grid>

        {/* ── Select ────────────────────────────────────────────────────── */}
        <Grid item xs={12} sm={6}>
          <InputLabel htmlFor="reporting_period" sx={{ mb: 0.5, fontWeight: 500 }}>
            Compliance Period
          </InputLabel>
          <Controller
            name="reporting_period"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                id="reporting_period"
                select
                fullWidth
                size="small"
                error={!!errors.reporting_period}
                helperText={errors.reporting_period?.message}
              >
                {REPORTING_PERIODS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>

        {/* ── Radio ─────────────────────────────────────────────────────── */}
        <Grid item xs={12} sm={6}>
          <FormControl error={!!errors.declaration_type}>
            <FormLabel sx={{ fontWeight: 500, color: 'text.primary', mb: 0.5 }}>
              Declaration Type
            </FormLabel>
            <Controller
              name="declaration_type"
              control={control}
              render={({ field }) => (
                <RadioGroup {...field} row>
                  {['Full', 'Partial', 'Amended'].map((opt) => (
                    <FormControlLabel
                      key={opt}
                      value={opt}
                      control={<Radio size="small" />}
                      label={opt}
                    />
                  ))}
                </RadioGroup>
              )}
            />
            {errors.declaration_type && (
              <FormHelperText>{errors.declaration_type.message}</FormHelperText>
            )}
          </FormControl>
        </Grid>

        <Grid item xs={12}><Divider /></Grid>

        {/* ── Text ──────────────────────────────────────────────────────── */}
        <Grid item xs={12} sm={6}>
          <InputLabel htmlFor="contact_name" sx={{ mb: 0.5, fontWeight: 500 }}>
            Contact Name
          </InputLabel>
          <TextField
            id="contact_name"
            fullWidth
            size="small"
            error={!!errors.contact_name}
            helperText={errors.contact_name?.message}
            {...register('contact_name')}
          />
        </Grid>

        {/* ── Email (text type="email") ──────────────────────────────────── */}
        <Grid item xs={12} sm={6}>
          <InputLabel htmlFor="contact_email" sx={{ mb: 0.5, fontWeight: 500 }}>
            Contact Email
          </InputLabel>
          <TextField
            id="contact_email"
            type="email"
            fullWidth
            size="small"
            error={!!errors.contact_email}
            helperText={errors.contact_email?.message}
            {...register('contact_email')}
          />
        </Grid>

        <Grid item xs={12}><Divider /></Grid>

        {/* ── Select (fuel type) ────────────────────────────────────────── */}
        <Grid item xs={12} sm={4}>
          <InputLabel htmlFor="fuel_type" sx={{ mb: 0.5, fontWeight: 500 }}>
            Fuel Type
          </InputLabel>
          <Controller
            name="fuel_type"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                id="fuel_type"
                select
                fullWidth
                size="small"
                error={!!errors.fuel_type}
                helperText={errors.fuel_type?.message}
              >
                {FUEL_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>

        {/* ── Number ────────────────────────────────────────────────────── */}
        <Grid item xs={12} sm={4}>
          <InputLabel htmlFor="quantity" sx={{ mb: 0.5, fontWeight: 500 }}>
            Quantity
          </InputLabel>
          <Controller
            name="quantity"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                id="quantity"
                type="number"
                fullWidth
                size="small"
                inputProps={{ min: 0, step: 'any' }}
                error={!!errors.quantity}
                helperText={errors.quantity?.message}
              />
            )}
          />
        </Grid>

        {/* ── Radio (units) ─────────────────────────────────────────────── */}
        <Grid item xs={12} sm={4}>
          <FormControl error={!!errors.units}>
            <FormLabel sx={{ fontWeight: 500, color: 'text.primary', mb: 0.5 }}>Units</FormLabel>
            <Controller
              name="units"
              control={control}
              render={({ field }) => (
                <RadioGroup {...field} row>
                  {['L', 'kg', 'kWh', 'GJ'].map((u) => (
                    <FormControlLabel
                      key={u}
                      value={u}
                      control={<Radio size="small" />}
                      label={u}
                    />
                  ))}
                </RadioGroup>
              )}
            />
            {errors.units && <FormHelperText>{errors.units.message}</FormHelperText>}
          </FormControl>
        </Grid>

        <Grid item xs={12}><Divider /></Grid>

        {/* ── Textarea ──────────────────────────────────────────────────── */}
        <Grid item xs={12}>
          <InputLabel htmlFor="notes" sx={{ mb: 0.5, fontWeight: 500 }}>
            Additional Notes <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>(optional)</Box>
          </InputLabel>
          <TextField
            id="notes"
            fullWidth
            multiline
            rows={3}
            placeholder="Enter any additional information relevant to this declaration…"
            error={!!errors.notes}
            helperText={errors.notes?.message}
            {...register('notes')}
          />
        </Grid>

        <Grid item xs={12}><Divider /></Grid>

        {/* ── Checkbox ──────────────────────────────────────────────────── */}
        <Grid item xs={12}>
          <BCTypography variant="body2" color="text.secondary" mb={1}>
            I hereby certify that the information provided in this declaration is true,
            accurate, and complete to the best of my knowledge.
          </BCTypography>
          <Controller
            name="certified"
            control={control}
            render={({ field }) => (
              <FormControl error={!!errors.certified}>
                <FormControlLabel
                  control={
                    <Checkbox {...field} checked={field.value} data-test="certify-checkbox" />
                  }
                  label={
                    <BCTypography variant="body2">
                      I certify the above declaration is accurate and complete
                    </BCTypography>
                  }
                />
                {errors.certified && (
                  <FormHelperText>{errors.certified.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        </Grid>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {downloadSuccess && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleOutlineIcon color="success" fontSize="small" />
                <BCTypography variant="body2" color="success">Downloaded</BCTypography>
              </Box>
            )}
            <BCButton
              variant="outlined"
              size="medium"
              color="primary"
              data-test="generate-pdf"
              isLoading={downloading === 'pdf'}
              disabled={!!downloading}
              onClick={handleSubmit((values) => exportForm(values, 'pdf'))}
              startIcon={downloading === 'pdf' ? undefined : <PictureAsPdfIcon fontSize="small" />}
            >
              <BCTypography variant="button">
                {downloading === 'pdf' ? 'Generating…' : 'Export as PDF'}
              </BCTypography>
            </BCButton>
            <BCButton
              type="submit"
              variant="contained"
              size="medium"
              color="primary"
              data-test="generate-docx"
              isLoading={downloading === 'docx'}
              disabled={!!downloading}
              startIcon={
                downloading === 'docx'
                  ? undefined
                  : <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
              }
            >
              <BCTypography variant="button">
                {downloading === 'docx' ? 'Generating…' : 'Export as Word (.docx)'}
              </BCTypography>
            </BCButton>
          </Box>
        </Grid>

      </Grid>
    </Box>
  )
}
