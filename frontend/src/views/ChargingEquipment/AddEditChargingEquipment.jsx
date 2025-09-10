import {
  faArrowLeft,
  faFloppyDisk,
  faTrashCan
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { yupResolver } from '@hookform/resolvers/yup'
import {
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Chip,
  OutlinedInput,
  Checkbox,
  ListItemText
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { chargingEquipmentSchema } from './_formSchema'

import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import Loading from '@/components/Loading'
import { ROUTES } from '@/routes/routes'
import {
  useGetChargingEquipment,
  useCreateChargingEquipment,
  useUpdateChargingEquipment,
  useDeleteChargingEquipment,
  useChargingEquipmentMetadata,
  useChargingSites,
  useOrganizations
} from '@/hooks/useChargingEquipment'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const AddEditChargingEquipment = () => {
  const { t } = useTranslation(['common', 'chargingEquipment'])
  const navigate = useNavigate()
  const alertRef = useRef(null)
  const location = useLocation()
  const { id } = useParams()
  
  const isEditMode = Boolean(id)
  const { data: currentUser } = useCurrentUser()
  
  // Hooks for data and mutations
  const {
    data: equipment,
    isLoading: equipmentLoading,
    isError: equipmentError
  } = useGetChargingEquipment(id, { enabled: isEditMode })
  
  const {
    statuses,
    levels,
    endUseTypes,
    isLoading: metadataLoading
  } = useChargingEquipmentMetadata()
  
  const { data: chargingSites, isLoading: sitesLoading } = useChargingSites()
  const { data: organizations, isLoading: orgsLoading } = useOrganizations()
  
  const createMutation = useCreateChargingEquipment()
  const updateMutation = useUpdateChargingEquipment()
  const deleteMutation = useDeleteChargingEquipment()
  
  // Form setup with react-hook-form and yup validation
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
    control,
    reset
  } = useForm({
    resolver: yupResolver(chargingEquipmentSchema),
    defaultValues: {
      charging_site_id: '',
      allocating_organization_id: '',
      serial_number: '',
      manufacturer: '',
      model: '',
      level_of_equipment_id: '',
      ports: '',
      notes: '',
      intended_use_ids: []
    }
  })

  // Load equipment data into form when editing
  useEffect(() => {
    if (isEditMode && equipment) {
      reset({
        charging_site_id: equipment.charging_site_id || '',
        allocating_organization_id: equipment.allocating_organization_id || '',
        serial_number: equipment.serial_number || '',
        manufacturer: equipment.manufacturer || '',
        model: equipment.model || '',
        level_of_equipment_id: equipment.level_of_equipment_id || '',
        ports: equipment.ports || '',
        notes: equipment.notes || '',
        intended_use_ids: equipment.intended_uses?.map(use => use.end_use_type_id) || []
      })
    }
  }, [equipment, reset, isEditMode])

  // Handle form submission
  const onSubmit = async (formData) => {
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          id: parseInt(id),
          data: formData
        })
        alertRef.current?.triggerAlert({
          message: t('chargingEquipment:updateSuccess'),
          severity: 'success'
        })
      } else {
        const result = await createMutation.mutateAsync(formData)
        alertRef.current?.triggerAlert({
          message: t('chargingEquipment:createSuccess'),
          severity: 'success'
        })
        // Navigate to edit mode for the new equipment
        navigate(ROUTES.CHARGING_EQUIPMENT.EDIT.replace(':id', result.charging_equipment_id))
      }
    } catch (error) {
      alertRef.current?.triggerAlert({
        message: error.message || t('chargingEquipment:saveError'),
        severity: 'error'
      })
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!window.confirm(t('chargingEquipment:deleteConfirmation'))) {
      return
    }
    
    try {
      await deleteMutation.mutateAsync(parseInt(id))
      navigate(ROUTES.CHARGING_EQUIPMENT.LIST, {
        state: {
          message: t('chargingEquipment:deleteSuccess'),
          severity: 'success'
        }
      })
    } catch (error) {
      alertRef.current?.triggerAlert({
        message: error.message || t('chargingEquipment:deleteError'),
        severity: 'error'
      })
    }
  }

  const handleCancel = () => {
    navigate(ROUTES.CHARGING_EQUIPMENT.LIST)
  }

  if (equipmentLoading || metadataLoading || sitesLoading || orgsLoading) {
    return <Loading />
  }

  if (isEditMode && equipmentError) {
    return (
      <BCAlert severity="error">
        {t('chargingEquipment:loadError')}
      </BCAlert>
    )
  }

  const canEdit = !isEditMode || 
    (equipment?.status && ['Draft', 'Updated', 'Validated'].includes(equipment.status))
  
  const canDelete = isEditMode && equipment?.status === 'Draft'

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <BCTypography variant="h4">
            {isEditMode 
              ? t('chargingEquipment:editEquipment') 
              : t('chargingEquipment:newEquipment')
            }
          </BCTypography>
          <Box display="flex" gap={1}>
            <BCButton
              variant="outlined"
              startIcon={<FontAwesomeIcon icon={faArrowLeft} />}
              onClick={handleCancel}
            >
              {t('common:back')}
            </BCButton>
          </Box>
        </Box>

        {isEditMode && equipment && (
          <Box mb={2}>
            <Chip 
              label={equipment.status} 
              color={equipment.status === 'Draft' ? 'warning' : 'success'}
              variant="outlined"
            />
            {equipment.registration_number && (
              <BCTypography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('chargingEquipment:registrationNumber')}: {equipment.registration_number}
              </BCTypography>
            )}
          </Box>
        )}
      </Grid>

      <Grid item xs={12}>
        <BCAlert ref={alertRef} />
      </Grid>

      <Grid item xs={12}>
        <Paper sx={{ p: 3 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              {/* Charging Site Selection */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!errors.charging_site_id}>
                  <InputLabel>{t('chargingEquipment:chargingSite')} *</InputLabel>
                  <Controller
                    name="charging_site_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        label={t('chargingEquipment:chargingSite')}
                        disabled={!canEdit}
                      >
                        {chargingSites.map((site) => (
                          <MenuItem key={site.charging_site_id} value={site.charging_site_id}>
                            {site.site_name} ({site.site_code})
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                  {errors.charging_site_id && (
                    <BCTypography variant="caption" color="error">
                      {errors.charging_site_id.message}
                    </BCTypography>
                  )}
                </FormControl>
              </Grid>

              {/* Allocating Organization */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('chargingEquipment:allocatingOrganization')}</InputLabel>
                  <Controller
                    name="allocating_organization_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        label={t('chargingEquipment:allocatingOrganization')}
                        disabled={!canEdit}
                      >
                        <MenuItem value="">
                          <em>{t('common:none')}</em>
                        </MenuItem>
                        {organizations.map((org) => (
                          <MenuItem key={org.organization_id} value={org.organization_id}>
                            {org.name}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                </FormControl>
              </Grid>

              {/* Serial Number */}
              <Grid item xs={12} md={6}>
                <TextField
                  {...register('serial_number')}
                  label={t('chargingEquipment:serialNumber')}
                  fullWidth
                  required
                  disabled={!canEdit}
                  error={!!errors.serial_number}
                  helperText={errors.serial_number?.message}
                />
              </Grid>

              {/* Manufacturer */}
              <Grid item xs={12} md={6}>
                <TextField
                  {...register('manufacturer')}
                  label={t('chargingEquipment:manufacturer')}
                  fullWidth
                  required
                  disabled={!canEdit}
                  error={!!errors.manufacturer}
                  helperText={errors.manufacturer?.message}
                />
              </Grid>

              {/* Model */}
              <Grid item xs={12} md={6}>
                <TextField
                  {...register('model')}
                  label={t('chargingEquipment:model')}
                  fullWidth
                  disabled={!canEdit}
                  error={!!errors.model}
                  helperText={errors.model?.message}
                />
              </Grid>

              {/* Level of Equipment */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!errors.level_of_equipment_id}>
                  <InputLabel>{t('chargingEquipment:levelOfEquipment')} *</InputLabel>
                  <Controller
                    name="level_of_equipment_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        label={t('chargingEquipment:levelOfEquipment')}
                        disabled={!canEdit}
                      >
                        {levels?.map((level) => (
                          <MenuItem key={level.level_of_equipment_id} value={level.level_of_equipment_id}>
                            {level.name}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                  {errors.level_of_equipment_id && (
                    <BCTypography variant="caption" color="error">
                      {errors.level_of_equipment_id.message}
                    </BCTypography>
                  )}
                </FormControl>
              </Grid>

              {/* Ports */}
              <Grid item xs={12} md={6}>
                <FormControl>
                  <FormLabel>{t('chargingEquipment:ports')}</FormLabel>
                  <Controller
                    name="ports"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        {...field}
                        row
                        disabled={!canEdit}
                      >
                        <FormControlLabel
                          value="Single port"
                          control={<Radio />}
                          label={t('chargingEquipment:singlePort')}
                        />
                        <FormControlLabel
                          value="Dual port"
                          control={<Radio />}
                          label={t('chargingEquipment:dualPort')}
                        />
                      </RadioGroup>
                    )}
                  />
                </FormControl>
              </Grid>

              {/* Intended Uses */}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>{t('chargingEquipment:intendedUses')}</InputLabel>
                  <Controller
                    name="intended_use_ids"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        multiple
                        input={<OutlinedInput label={t('chargingEquipment:intendedUses')} />}
                        disabled={!canEdit}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => {
                              const endUseType = endUseTypes?.find(
                                (type) => type.end_use_type_id === value
                              )
                              return (
                                <Chip
                                  key={value}
                                  label={endUseType?.type || value}
                                  size="small"
                                />
                              )
                            })}
                          </Box>
                        )}
                      >
                        {endUseTypes?.map((endUseType) => (
                          <MenuItem
                            key={endUseType.end_use_type_id}
                            value={endUseType.end_use_type_id}
                          >
                            <Checkbox
                              checked={field.value.indexOf(endUseType.end_use_type_id) > -1}
                            />
                            <ListItemText primary={endUseType.type} />
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                </FormControl>
              </Grid>

              {/* Notes */}
              <Grid item xs={12}>
                <TextField
                  {...register('notes')}
                  label={t('chargingEquipment:notes')}
                  fullWidth
                  multiline
                  rows={4}
                  disabled={!canEdit}
                  error={!!errors.notes}
                  helperText={errors.notes?.message}
                />
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box display="flex" justifyContent="space-between" mt={2}>
                  <Box display="flex" gap={2}>
                    <BCButton
                      variant="contained"
                      type="submit"
                      startIcon={<FontAwesomeIcon icon={faFloppyDisk} />}
                      disabled={
                        !canEdit || 
                        !isDirty || 
                        createMutation.isLoading || 
                        updateMutation.isLoading
                      }
                    >
                      {isEditMode ? t('common:save') : t('common:create')}
                    </BCButton>
                    
                    <BCButton
                      variant="outlined"
                      onClick={handleCancel}
                    >
                      {t('common:cancel')}
                    </BCButton>
                  </Box>

                  {canDelete && (
                    <BCButton
                      variant="outlined"
                      color="error"
                      startIcon={<FontAwesomeIcon icon={faTrashCan} />}
                      onClick={handleDelete}
                      disabled={deleteMutation.isLoading}
                    >
                      {t('common:delete')}
                    </BCButton>
                  )}
                </Box>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Grid>
    </Grid>
  )
}