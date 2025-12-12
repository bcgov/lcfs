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
import { govRoles } from '@/constants/roles'
import { ExcelUpload } from './components/ExcelUpload'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules'

// Row validation helper - checks all required fields, returns boolean
export const isRowValid = (row) =>
  Boolean(
    row?.chargingSiteId &&
      row?.serialNumber &&
      row?.manufacturer &&
      row?.levelOfEquipmentId &&
      row?.intendedUseIds?.length > 0 &&
      row?.intendedUserIds?.length > 0
  )

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

  const { data: currentUser, hasAnyRole } = useCurrentUser()

  // Check if user is IDIR/government - they should not access this component
  useEffect(() => {
    const isIDIR = hasAnyRole(...govRoles)
    if (isIDIR) {
      // Redirect IDIR users back to the main FSE list
      navigate(ROUTES.REPORTS.LIST + '/fse', {
        replace: true,
        state: {
          message:
            'IDIR users cannot edit FSE equipment directly. Use the FSE processing workflow through charging sites.',
          severity: 'info'
        }
      })
    }
  }, [hasAnyRole, navigate])

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
    endUserTypes,
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

  // Navigate back to origin page or default to Manage FSE
  const navigateBack = useCallback(() => {
    navigate(location.state?.returnTo || `${ROUTES.REPORTS.LIST}/fse`)
  }, [navigate, location.state?.returnTo])

  const handleCancel = useCallback(() => {
    navigateBack()
  }, [navigateBack])

  // Unified save handler for grid rows (create/update/delete)
  const saveRow = useCallback(
    async (data) => {
      // Map API shape; when editing existing, backend uses id param
      if (data.deleted) {
        if (data.chargingEquipmentId) {
          await deleteMutation.mutateAsync(parseInt(data.chargingEquipmentId))
        }
        return { data: { chargingEquipmentId: data.chargingEquipmentId } }
      }

      if (data.chargingEquipmentId) {
        const updated = await updateMutation.mutateAsync({
          id: parseInt(data.chargingEquipmentId),
          data
        })
        return { data: updated }
      }

      const created = await createMutation.mutateAsync(data)
      return { data: created }
    },
    [createMutation, updateMutation, deleteMutation]
  )

  // Grid event handlers
  const handleCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      const updatedData = {
        ...Object.entries(params.node.data)
          .filter(
            ([, value]) => value !== null && value !== '' && value !== undefined
          )
          .reduce((acc, [key, value]) => {
            acc[key] = value
            return acc
          }, {}),
        chargingEquipmentId: equipment?.chargingEquipmentId,
        status: equipment?.status || 'Draft'
      }

      const canEdit =
        !isEdit ||
        (equipment?.status &&
          ['Draft', 'Updated', 'Validated'].includes(equipment.status))
      if (!canEdit) return

      // Validate required fields before saving
      if (!isRowValid(params.node.data)) {
        params.node.updateData({
          ...params.node.data,
          validationStatus: 'error'
        })
        setGridErrors({
          [params.node.data.id]: ['intendedUseIds', 'intendedUserIds']
        })
        alertRef.current?.triggerAlert({
          message: t('chargingEquipment:validation.fillRequiredFields'),
          severity: 'error'
        })
        return
      }

      try {
        const responseData = await handleScheduleSave({
          alertRef,
          idField: 'chargingEquipmentId',
          labelPrefix: 'chargingEquipment',
          params,
          setErrors: setGridErrors,
          setWarnings: setGridWarnings,
          saveRow,
          t,
          updatedData
        })

        params.node.updateData(responseData)
        alertRef.current?.triggerAlert({
          message: isEdit
            ? t('chargingEquipment:updateSuccess')
            : t('chargingEquipment:createSuccess'),
          severity: 'success'
        })
      } catch (error) {
        alertRef.current?.triggerAlert({
          message: error.message || 'Failed to save equipment',
          severity: 'error'
        })
      }
    },
    [equipment, isEdit, alertRef, saveRow, t]
  )

  const handleGridAction = useCallback(
    async (action, params) => {
      if (action === 'delete' && isEdit && equipment?.status === 'Draft') {
        try {
          await handleScheduleDelete(
            params,
            'chargingEquipmentId',
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
    },
    [isEdit, equipment, deleteMutation.mutateAsync, handleCancel]
  )

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
      chargingSiteId: '',
      serialNumber: '',
      manufacturer: '',
      model: '',
      levelOfEquipmentId: '',
      ports: '',
      notes: '',
      latitude: 0,
      longitude: 0,
      intendedUseIds: [],
      intendedUserIds: []
    }
  })

  // Load equipment data into form when editing
  useEffect(() => {
    if (isEdit && equipment) {
      reset({
        chargingSiteId: equipment.chargingSiteId || '',
        serialNumber: equipment.serialNumber || '',
        manufacturer: equipment.manufacturer || '',
        model: equipment.model || '',
        levelOfEquipmentId: equipment.levelOfEquipmentId || '',
        ports: equipment.ports || '',
        notes: equipment.notes || '',
        latitude: equipment.latitude || 0,
        longitude: equipment.longitude || 0,
        intendedUseIds:
          equipment.intendedUses?.map((use) => use.endUseTypeId) || [],
        intendedUserIds:
          equipment.intendedUsers?.map((user) => user.endUserTypeId) || []
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
          `${ROUTES.REPORTS.LIST}/fse/${result.chargingEquipmentId}/edit`
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

  // Default empty row template
  const getEmptyRow = (id = Date.now()) => ({
    id,
    chargingSiteId: '',
    serialNumber: '',
    manufacturer: '',
    model: '',
    levelOfEquipmentId: '',
    ports: '',
    latitude: 0,
    longitude: 0,
    notes: '',
    intendedUseIds: [],
    intendedUserIds: []
  })

  // Bulk mode handlers
  const handleAddRow = () => {
    setBulkData([...bulkData, getEmptyRow()])
  }

  // Auto-create one row on load to match Charging Site UX
  useEffect(() => {
    if (isBulkMode && bulkData.length === 0) {
      handleAddRow()
    }
  }, [isBulkMode, bulkData.length])

  const handleBulkSave = async () => {
    try {
      const rowData = []
      gridRef.current?.api?.forEachNode((node) => rowData.push(node.data))

      const validRows = rowData.filter(isRowValid)

      if (validRows.length === 0) {
        alertRef.current?.triggerAlert({
          message: t('chargingEquipment:validation.fillRequiredFields'),
          severity: 'warning'
        })
        return
      }

      await Promise.all(validRows.map((row) => saveRow(row)))

      alertRef.current?.triggerAlert({
        message: `Successfully saved ${validRows.length} charging equipment entries.`,
        severity: 'success'
      })

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
              mb={0}
            >
              <BCTypography variant="h5" color="primary">
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
            <Paper sx={{ p: 3 }}>
              <BCTypography variant="h6" gutterBottom color="primary">
                {t('chargingEquipment:bulkInputTitle')}
              </BCTypography>
              <BCTypography variant="body2" color="text.secondary" paragraph>
                {t('chargingEquipment:bulkInputDescription')}
              </BCTypography>

              <ExcelUpload
                onDataParsed={(data) => {
                  setBulkData(data)
                }}
                chargingSites={chargingSites}
                organizations={organizations}
                levels={levels}
                endUseTypes={endUseTypes}
                endUserTypes={endUserTypes}
              />

              <BCGridEditor
                gridRef={gridRef}
                rowData={bulkData}
                columnDefs={bulkChargingEquipmentColDefs(
                  chargingSites,
                  organizations,
                  levels,
                  endUseTypes,
                  endUserTypes,
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
                    chargingEquipmentId: params.node.data.chargingEquipmentId,
                    status: 'Draft'
                  }

                  const responseData = await handleScheduleSave({
                    alertRef,
                    idField: 'chargingEquipmentId',
                    labelPrefix: 'chargingEquipment',
                    params,
                    setErrors: setGridErrors,
                    setWarnings: setGridWarnings,
                    saveRow,
                    t,
                    updatedData
                  })

                  params.node.updateData(responseData)

                  // Update bulkData state with the saved data including chargingEquipmentId
                  const updatedBulkData = [...bulkData]
                  const rowIndex = updatedBulkData.findIndex(
                    (row) => row.id === params.data.id
                  )
                  if (rowIndex >= 0) {
                    updatedBulkData[rowIndex] = responseData
                    setBulkData(updatedBulkData)
                  }
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
                      'chargingEquipmentId',
                      saveRow,
                      alertRef,
                      setBulkData,
                      getEmptyRow()
                    )
                  }
                }}
                onAddRows={(numRows) =>
                  Array(numRows)
                    .fill()
                    .map(() => getEmptyRow(Date.now() + Math.random()))
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

          <Grid item xs={12}>
            <BCAlert2 ref={alertRef} dismissible={true} sx={{ mb: 1 }} />
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
                  {equipment.status} •{' '}
                  {t('chargingEquipment:registrationNumber')}:{' '}
                  {equipment.registrationNumber || ''}
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
          <Box sx={{ width: '100%' }}>
            <BCGridEditor
              gridRef={gridRef}
              alertRef={alertRef}
              stopEditingWhenCellsLoseFocus
              columnDefs={bulkChargingEquipmentColDefs(
                chargingSites,
                organizations,
                levels,
                endUseTypes,
                endUserTypes,
                gridErrors,
                gridWarnings,
                { enableDelete: isEdit && equipment?.status === 'Draft' },
                true,
                isEdit && equipment?.status === 'Draft'
              )}
              defaultColDef={{ ...defaultBulkColDef, singleClickEdit: canEdit }}
              rowData={[
                {
                  id: equipment?.chargingEquipmentId || Date.now(),
                  chargingEquipmentId: equipment?.chargingEquipmentId,
                  chargingSiteId: equipment?.chargingSiteId || '',
                  serialNumber: equipment?.serialNumber || '',
                  manufacturer: equipment?.manufacturer || '',
                  model: equipment?.model || '',
                  levelOfEquipmentId: equipment?.levelOfEquipmentId || '',
                  ports: equipment?.ports || '',
                  latitude: equipment?.latitude || 0,
                  longitude: equipment?.longitude || 0,
                  notes: equipment?.notes || '',
                  intendedUseIds:
                    equipment?.intendedUses?.map((use) => use.endUseTypeId) ||
                    [],
                  intendedUserIds:
                    equipment?.intendedUsers?.map(
                      (user) => user.endUserTypeId
                    ) || [],
                  status: equipment?.status || 'Draft'
                }
              ]}
              onCellEditingStopped={handleCellEditingStopped}
              onAction={handleGridAction}
              showAddRowsButton={false}
              saveButtonProps={{
                enabled: true,
                text: t('chargingEquipment:saveAndReturn'),
                onSave: navigateBack
              }}
            />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <BCAlert2 ref={alertRef} dismissible={true} sx={{ mb: 0.5 }} />
        </Grid>
      </Grid>
    </BCBox>
  )
}

export default AddEditChargingEquipment
