import {
  faArrowLeft,
  faFloppyDisk,
  faTrashCan,
  faPlus
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
import BCBox from '@/components/BCBox'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { chargingEquipmentSchema } from './_formSchema'
import { bulkChargingEquipmentColDefs, defaultBulkColDef } from './_bulkSchema'

import BCAlert, { BCAlert2 } from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import Loading from '@/components/Loading'
import { ROUTES } from '@/routes/routes'
import {
  useGetChargingEquipment,
  useCreateChargingEquipment,
  useUpdateChargingEquipment,
  useDeleteChargingEquipment,
  useChargingEquipmentMetadata,
  useChargingSites,
  useOrganizations,
  useHasAllocationAgreements
} from '@/hooks/useChargingEquipment'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ExcelUpload } from './components/ExcelUpload'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules'

export const AddEditChargingEquipment = ({ mode }) => {
  const { t } = useTranslation(['common', 'chargingEquipment'])
  const navigate = useNavigate()
  const alertRef = useRef(null)
  const location = useLocation()
  // Route param is defined as :fseId in routes; use that
  const { fseId } = useParams()

  // Determine mode: 'single' (edit existing), 'bulk' (mass input)
  const operationMode = mode || (fseId ? 'single' : 'bulk')
  const isEdit = operationMode === 'single' && Boolean(fseId)
  const isBulkMode = operationMode === 'bulk'

  const { data: currentUser } = useCurrentUser()

  // Hooks for data and mutations
  const {
    data: equipment,
    isLoading: equipmentLoading,
    isError: equipmentError
  } = useGetChargingEquipment(fseId)

  const {
    statuses,
    levels,
    endUseTypes,
    isLoading: metadataLoading
  } = useChargingEquipmentMetadata()

  const { data: chargingSites, isLoading: sitesLoading } = useChargingSites()
  const { data: organizations, isLoading: orgsLoading } = useOrganizations()
  const { data: hasAllocationAgreements } = useHasAllocationAgreements()

  const createMutation = useCreateChargingEquipment()
  const updateMutation = useUpdateChargingEquipment()
  const deleteMutation = useDeleteChargingEquipment()

  // Bulk mode state (grid-based input like Charging Site/FSE)
  const [bulkData, setBulkData] = useState([])
  const [gridErrors, setGridErrors] = useState({})
  const [gridWarnings, setGridWarnings] = useState({})
  const gridRef = useRef(null)

  // Navigation handler
  const handleCancel = useCallback(() => {
    navigate(`${ROUTES.REPORTS.LIST}/fse`)
  }, [navigate])

  // Grid event handlers
  const handleCellEditingStopped = useCallback(async (params) => {
    if (params.oldValue === params.newValue) return

    const updatedData = {
      ...Object.entries(params.node.data)
        .filter(
          ([, value]) =>
            value !== null && value !== '' && value !== undefined
        )
        .reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {}),
      charging_equipment_id: equipment?.charging_equipment_id,
      status: equipment?.status || 'Draft'
    }

    const canEdit = !isEdit || (equipment?.status && ['Draft', 'Updated', 'Validated'].includes(equipment.status))
    if (!canEdit) return

    try {
      const responseData = await handleScheduleSave({
        alertRef,
        idField: 'charging_equipment_id',
        labelPrefix: 'chargingEquipment',
        params,
        setErrors: setGridErrors,
        setWarnings: setGridWarnings,
        saveRow: updateMutation.mutateAsync,
        t,
        updatedData
      })

      params.node.updateData(responseData)
      alertRef.current?.triggerAlert({
        message: t('chargingEquipment:updateSuccess'),
        severity: 'success'
      })
    } catch (error) {
      alertRef.current?.triggerAlert({
        message: error.message || 'Failed to update equipment',
        severity: 'error'
      })
    }
  }, [equipment, isEdit, alertRef, updateMutation.mutateAsync, t])

  const handleGridAction = useCallback(async (action, params) => {
    if (action === 'delete' && isEdit && equipment?.status === 'Draft') {
      try {
        await handleScheduleDelete(
          params,
          'charging_equipment_id',
          deleteMutation.mutateAsync,
          alertRef,
          () => {},
          {}
        )
        handleCancel()
      } catch (error) {
        alertRef.current?.triggerAlert({
          message: error.message || 'Failed to delete equipment',
          severity: 'error'
        })
      }
    }
  }, [isEdit, equipment, deleteMutation.mutateAsync, handleCancel])

  // Form setup with react-hook-form and yup validation
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isDirty },
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
    if (isEdit && equipment) {
      reset({
        charging_site_id: equipment.charging_site_id || '',
        allocating_organization_id: equipment.allocating_organization_id || '',
        serial_number: equipment.serial_number || '',
        manufacturer: equipment.manufacturer || '',
        model: equipment.model || '',
        level_of_equipment_id: equipment.level_of_equipment_id || '',
        ports: equipment.ports || '',
        notes: equipment.notes || '',
        intended_use_ids:
          equipment.intended_uses?.map((use) => use.end_use_type_id) || []
      })
    }
  }, [equipment, reset, isEdit])

  // Handle form submission
  const onSubmit = async (formData) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: parseInt(fseId),
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
        navigate(
          `${ROUTES.REPORTS.LIST}/fse/${result.charging_equipment_id}/edit`
        )
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
      await deleteMutation.mutateAsync(parseInt(fseId))
      navigate(`${ROUTES.REPORTS.LIST}/fse`, {
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


  // Bulk mode handlers
  const handleAddRow = () => {
    const newRow = {
      id: Date.now(), // Temporary ID for new rows
      charging_site_id: '',
      allocating_organization_id: '',
      serial_number: '',
      manufacturer: '',
      model: '',
      level_of_equipment_id: '',
      ports: 'Single port',
      notes: '',
      intended_use_ids: []
    }
    setBulkData([...bulkData, newRow])
  }

  // Auto-create one row on load to match Charging Site UX
  useEffect(() => {
    if (isBulkMode && bulkData.length === 0) {
      handleAddRow()
    }
  }, [isBulkMode, bulkData.length])

  // Unified save handler for grid rows (create/update/delete)
  const saveRow = async (data) => {
    // Map API shape; when editing existing, backend uses id param
    if (data.deleted) {
      if (data.charging_equipment_id) {
        await deleteMutation.mutateAsync(parseInt(data.charging_equipment_id))
      }
      return { data: { charging_equipment_id: data.charging_equipment_id } }
    }

    if (data.charging_equipment_id) {
      const updated = await updateMutation.mutateAsync({
        id: parseInt(data.charging_equipment_id),
        data
      })
      return { data: updated }
    }

    const created = await createMutation.mutateAsync(data)
    return { data: created }
  }

  const handleBulkSave = async () => {
    try {
      // Filter out rows with missing required fields
      const validRows = bulkData.filter(
        (row) =>
          row.charging_site_id &&
          row.serial_number &&
          row.manufacturer &&
          row.level_of_equipment_id
      )

      if (validRows.length === 0) {
        alertRef.current?.triggerAlert({
          message: 'No valid rows to save. Please fill in required fields.',
          severity: 'warning'
        })
        return
      }

      // Save all valid rows
      const promises = validRows.map((row) => createMutation.mutateAsync(row))
      await Promise.all(promises)

      alertRef.current?.triggerAlert({
        message: `Successfully created ${validRows.length} charging equipment entries.`,
        severity: 'success'
      })

      // Navigate back to list
      navigate(`${ROUTES.REPORTS.LIST}/fse`)
    } catch (error) {
      alertRef.current?.triggerAlert({
        message: error.message || 'Error saving bulk data',
        severity: 'error'
      })
    }
  }

  if (equipmentLoading || metadataLoading || sitesLoading || orgsLoading) {
    return <Loading />
  }

  if (isEdit && equipmentError) {
    return (
      <BCAlert severity="error">{t('chargingEquipment:loadError')}</BCAlert>
    )
  }

  const canEdit =
    !isEdit ||
    (equipment?.status &&
      ['Draft', 'Updated', 'Validated'].includes(equipment.status))

  const canDelete = isEdit && equipment?.status === 'Draft'

  const containerSx = { width: '100%', px: { xs: 2, md: 3 } }

  // Render bulk mode
  if (isBulkMode) {
    return (
      <BCBox sx={containerSx}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={2}
              mb={2}
            >
              <BCTypography variant="h4">
                {t('chargingEquipment:newFSE')}
              </BCTypography>
              <BCButton
                variant="outlined"
                startIcon={<FontAwesomeIcon icon={faArrowLeft} />}
                onClick={handleCancel}
              >
                {t('common:back')}
              </BCButton>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <BCAlert2 ref={alertRef} dismissible={true} sx={{ mb: 1 }} />
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <BCTypography variant="h6" gutterBottom>
                {t('chargingEquipment:bulkInputTitle')}
              </BCTypography>
              <BCTypography variant="body2" color="text.secondary" paragraph>
                {t('chargingEquipment:bulkInputDescription')}
              </BCTypography>

              <ExcelUpload
                onDataParsed={(data) => {
                  setBulkData(data)
                  alertRef.current?.clearAlert()
                }}
                chargingSites={chargingSites}
                organizations={organizations}
                levels={levels}
                endUseTypes={endUseTypes}
              />

              <BCGridEditor
                gridRef={gridRef}
                rowData={bulkData}
                columnDefs={bulkChargingEquipmentColDefs(
                  chargingSites,
                  organizations,
                  levels,
                  endUseTypes,
                  gridErrors,
                  gridWarnings
                )}
                defaultColDef={defaultBulkColDef}
                stopEditingWhenCellsLoseFocus
                onCellEditingStopped={async (params) => {
                  if (params.oldValue === params.newValue) return

                  params.node.updateData({
                    ...params.node.data,
                    validationStatus: 'pending'
                  })

                  const updatedData = {
                    ...Object.entries(params.node.data)
                      .filter(
                        ([, value]) =>
                          value !== null && value !== '' && value !== undefined
                      )
                      .reduce((acc, [key, value]) => {
                        acc[key] = value
                        return acc
                      }, {}),
                    status: 'Draft'
                  }

                  const responseData = await handleScheduleSave({
                    alertRef,
                    idField: 'charging_equipment_id',
                    labelPrefix: 'chargingEquipment',
                    params,
                    setErrors: setGridErrors,
                    setWarnings: setGridWarnings,
                    saveRow,
                    t,
                    updatedData
                  })

                  alertRef.current?.clearAlert()
                  params.node.updateData(responseData)
                }}
                onCellValueChanged={(params) => {
                  const updatedData = [...bulkData]
                  const rowIndex = updatedData.findIndex(
                    (row) => row.id === params.data.id
                  )
                  if (rowIndex >= 0) {
                    updatedData[rowIndex] = params.data
                    setBulkData(updatedData)
                  }
                }}
                onAction={async (action, params) => {
                  if (action === 'delete') {
                    await handleScheduleDelete(
                      params,
                      'charging_equipment_id',
                      saveRow,
                      alertRef,
                      setBulkData,
                      {
                        charging_site_id: '',
                        allocating_organization_id: '',
                        serial_number: '',
                        manufacturer: '',
                        model: '',
                        level_of_equipment_id: '',
                        ports: 'Single port',
                        notes: '',
                        intended_use_ids: []
                      }
                    )
                  }
                }}
                onAddRows={(numRows) =>
                  Array(numRows)
                    .fill()
                    .map(() => ({
                      id: Date.now() + Math.random(),
                      charging_site_id: '',
                      allocating_organization_id: '',
                      serial_number: '',
                      manufacturer: '',
                      model: '',
                      level_of_equipment_id: '',
                      ports: 'Single port',
                      notes: '',
                      intended_use_ids: []
                    }))
                }
                saveButtonProps={{
                  enabled: true,
                  text: 'Save All',
                  onSave: handleBulkSave,
                  confirmText: 'You have unsaved or invalid rows.',
                  confirmLabel: 'Save and return'
                }}
                suppressRowClickSelection={true}
              />

              <Box display="flex" gap={2} mt={2}>
                <BCButton variant="outlined" onClick={handleCancel}>
                  {t('common:back')}
                </BCButton>
              </Box>
            </Paper>
          </Grid>
      </Grid>
    </BCBox>
  )
}

  // Render single edit mode (simpler styling and conditional read-only per status)
  // Match Charging Site add/edit container layout
  return (
    <BCBox sx={containerSx}>
      <Grid container spacing={1}>
        <Grid item xs={12}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={2}
            mb={1}
            mt={3}
          >
            <Box>
              <BCTypography variant="h5" color="primary">
                {isEdit
                  ? t('chargingEquipment:editFSEShort')
                  : t('chargingEquipment:newFSE')}
              </BCTypography>
              {isEdit && equipment && (
                <BCTypography
                  variant="body2"
                  color="text.secondary"
                  component="div"
                >
                  {equipment.status} • {t('chargingEquipment:registrationNumber')}: {equipment.registration_number || ''}
                </BCTypography>
              )}
            </Box>
            <BCButton
              variant="outlined"
              startIcon={<FontAwesomeIcon icon={faArrowLeft} />}
              onClick={handleCancel}
            >
              {t('common:back')}
            </BCButton>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <BCAlert2 ref={alertRef} dismissible={true} sx={{ mb: 0.5 }} />
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ width: '100%' }}>
            <BCGridEditor
              gridRef={gridRef}
              alertRef={alertRef}
              columnDefs={bulkChargingEquipmentColDefs(
                chargingSites,
                organizations,
                levels,
                endUseTypes,
                gridErrors,
                gridWarnings,
                { enableDelete: isEdit && equipment?.status === 'Draft' },
                true,
                isEdit && equipment?.status === 'Draft'
              )}
              defaultColDef={{ ...defaultBulkColDef, singleClickEdit: canEdit }}
              rowData={[
                {
                  id: equipment?.charging_equipment_id || Date.now(),
                  charging_equipment_id: equipment?.charging_equipment_id,
                  charging_site_id: equipment?.charging_site_id || '',
                  allocating_organization_id:
                    equipment?.allocating_organization_id || '',
                  serial_number: equipment?.serial_number || '',
                  manufacturer: equipment?.manufacturer || '',
                  model: equipment?.model || '',
                  level_of_equipment_id: equipment?.level_of_equipment_id || '',
                  ports: equipment?.ports || 'Single port',
                  notes: equipment?.notes || '',
                  intended_use_ids:
                    equipment?.intended_uses?.map((use) => use.end_use_type_id) ||
                    [],
                  status: equipment?.status || 'Draft'
                }
              ]}
              onCellEditingStopped={handleCellEditingStopped}
              onAction={handleGridAction}
              showAddRowsButton={false}
              saveButtonProps={{
                enabled: true,
                text: t('chargingEquipment:saveAndReturn'),
                onSave: () => navigate(ROUTES.REPORTS.LIST + '/fse')
              }}
            />
          </Box>
        </Grid>
      </Grid>
    </BCBox>
  )
}

export default AddEditChargingEquipment
