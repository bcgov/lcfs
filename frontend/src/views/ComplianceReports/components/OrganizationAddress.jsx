import React, { useEffect, useState } from 'react'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useUpdateOrganizationSnapshot } from '@/hooks/useOrganizationSnapshot.js'
import { FormProvider, useForm } from 'react-hook-form'
import {
  BCFormText,
  BCFormAddressAutocomplete
} from '@/components/BCForm/index.js'
import { yupResolver } from '@hookform/resolvers/yup'
import { defaultValues } from '@/views/Users/AddEditUser/_schema.js'
import { Box, Stack, List, ListItem } from '@mui/material'
import BCButton from '@/components/BCButton/index.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import * as Yup from 'yup'
import { PHONE_REGEX, POSTAL_CODE_REGEX } from '@/constants/common'
import BCModal from '@/components/BCModal.jsx'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes.js'

// Required organization fields for compliance report submission
const REQUIRED_ORG_FIELDS = [
  'name',
  'operatingName',
  'email',
  'phone',
  'serviceAddress',
  'recordsAddress',
  'headOfficeAddress'
]

export const addressHasPostalCode = (value) =>
  POSTAL_CODE_REGEX.test(value || '')

export const addressWithPostalCode = (addressData) => {
  if (typeof addressData === 'string') {
    return addressData
  }

  const fullAddress = addressData?.fullAddress || ''
  const postalCode = addressData?.postalCode || addressData?.postal_code || ''

  if (!postalCode || addressHasPostalCode(fullAddress)) {
    return fullAddress
  }

  return `${fullAddress}, ${postalCode}`
}

export const OrganizationAddress = ({
  snapshotData,
  complianceReportId,
  isEditing,
  setIsEditing,
  isGovernmentUser,
  orgID,
  reportID
}) => {
  const { t } = useTranslation(['common', 'report', 'org'])
  const navigate = useNavigate()
  const [modalData, setModalData] = useState(null)
  const [sameAsLegalName, setSameAsLegalName] = useState(false)
  const [recordsSameAsService, setRecordsSameAsService] = useState(false)
  const [headOfficeSameAsService, setHeadOfficeSameAsService] = useState(false)

  const validationSchema = Yup.object({
    name: Yup.string().required('Legal name is required.'),
    operatingName: Yup.string().required('Operating name is required.'),
    phone: Yup.string()
      .required('Phone number is required.')
      .matches(PHONE_REGEX, 'Phone number is not valid'),
    email: Yup.string()
      .required('Email address is required.')
      .email('Please enter a valid email address.'),
    serviceAddress: Yup.string()
      .required('Service address is required.')
      .test(
        'postal-code',
        'Service address must include a valid postal code.',
        addressHasPostalCode
      ),
    recordsAddress: Yup.string()
      .required('Records address is required.')
      .test(
        'postal-code',
        'Records address must include a valid postal code.',
        addressHasPostalCode
      ),
    headOfficeAddress: Yup.string().required('Head office address is required.')
  })

  // Hook for updating the organization snapshot
  const { mutate: updateComplianceReport, isLoading: isUpdating } =
    useUpdateOrganizationSnapshot(complianceReportId)

  // Setting up the form
  const form = useForm({
    resolver: yupResolver(validationSchema),
    mode: 'onChange',
    defaultValues
  })
  const { handleSubmit, control, setValue, watch, reset } = form

  const serviceAddress = watch('serviceAddress')
  const legalName = watch('name')

  // If 'same as service address' is checked, automatically update records address
  useEffect(() => {
    if (recordsSameAsService && serviceAddress) {
      setValue('recordsAddress', serviceAddress)
    }
    if (headOfficeSameAsService && serviceAddress) {
      setValue('headOfficeAddress', serviceAddress)
    }
  }, [recordsSameAsService, serviceAddress, setValue, headOfficeSameAsService])

  // If 'same as legal name' is checked, automatically update operating name
  useEffect(() => {
    if (sameAsLegalName && legalName) {
      setValue('operatingName', legalName)
    }
  }, [sameAsLegalName, legalName, setValue])

  // Submission handlers
  const onSubmit = async (data) => {
    await updateComplianceReport(data)
    setIsEditing(false)
  }

  const onError = () => setModalData(null)

  const onCancel = () => {
    reset(snapshotData)
    setIsEditing(false)
  }

  // Checkbox to keep records address synced with service address
  const handleSameAddressChange = (event) => {
    setRecordsSameAsService(event.target.checked)
    if (event.target.checked) {
      setValue('recordsAddress', serviceAddress)
    }
  }
  const handleSameHeadOfficeAddressChange = (event) => {
    setHeadOfficeSameAsService(event.target.checked)
    if (event.target.checked) {
      setValue('headOfficeAddress', serviceAddress)
    }
  }

  // Checkbox to keep operating name synced with legal name
  const handleSameNameChange = (event) => {
    setSameAsLegalName(event.target.checked)
    if (event.target.checked) {
      setValue('operatingName', legalName)
    }
  }

  // Helpers to select addresses
  const handleSelectServiceAddress = (addressData) => {
    const selectedAddress = addressWithPostalCode(addressData)
    setValue('serviceAddress', selectedAddress, { shouldValidate: true })

    // If 'same as service address' is checked, automatically update records too
    if (recordsSameAsService) {
      setValue('recordsAddress', selectedAddress, { shouldValidate: true })
    }
    if (headOfficeSameAsService) {
      setValue('headOfficeAddress', selectedAddress, { shouldValidate: true })
    }
  }

  const handleSelectRecordsAddress = (addressData) => {
    setValue('recordsAddress', addressWithPostalCode(addressData), {
      shouldValidate: true
    })
  }

  const handleSelectHeadOfficeAddress = (addressData) => {
    setValue('headOfficeAddress', addressWithPostalCode(addressData), {
      shouldValidate: true
    })
  }
  // Sync state with snapshot data on load
  useEffect(() => {
    if (snapshotData) {
      reset(snapshotData)
      setSameAsLegalName(snapshotData.name === snapshotData.operatingName)
      setRecordsSameAsService(
        snapshotData.serviceAddress === snapshotData.recordsAddress
      )
      setHeadOfficeSameAsService(
        snapshotData.serviceAddress === snapshotData.headOfficeAddress
      )
    }
  }, [reset, snapshotData])

  // Required fields for the read-only view
  const requiredFields = REQUIRED_ORG_FIELDS

  // Define which form fields use regular text input vs address autocomplete
  const textFormFields = [
    {
      name: 'name',
      label: t('org:legalNameLabel')
    },
    {
      name: 'operatingName',
      label: t('org:operatingNameLabel'),
      checkbox: true,
      checkboxLabel: 'same as legal name',
      onCheckboxChange: handleSameNameChange,
      isChecked: sameAsLegalName,
      disabled: sameAsLegalName
    },
    {
      name: 'phone',
      label: t('org:phoneNbrLabel')
    },
    {
      name: 'email',
      label: t('org:emailAddrLabel')
    },
    {
      name: 'headOfficeAddress',
      label: isEditing
        ? t('report:hoAddrLabelEdit')
        : t('report:hoAddrLabelView'),
      onSelectAddress: handleSelectHeadOfficeAddress,
      onCheckboxChange: handleSameHeadOfficeAddressChange,
      checkbox: true,
      checkboxLabel: 'same as address for service',
      isChecked: headOfficeSameAsService,
      disabled: headOfficeSameAsService
    }
  ]

  const addressFormFields = [
    {
      name: 'serviceAddress',
      label: isEditing
        ? t('report:orgDetailsForm.serviceAddrLabelEdit')
        : t('report:orgDetailsForm.serviceAddrLabelView'),
      onSelectAddress: handleSelectServiceAddress
    },
    {
      name: 'recordsAddress',
      label: t('report:orgDetailsForm.bcRecordLabel'),
      checkbox: true,
      checkboxLabel: 'same as address for service',
      onCheckboxChange: handleSameAddressChange,
      isChecked: recordsSameAsService,
      disabled: recordsSameAsService,
      onSelectAddress: handleSelectRecordsAddress
    }
  ]

  // Merge text + address fields for read-only view
  const allFormFields = [
    ...textFormFields.slice(0, -1),
    ...addressFormFields,
    textFormFields.at(-1)
  ]
  const headOffice = textFormFields.at(-1)

  // Helper to show either the value or 'Required' in read-only mode
  const displayAddressValue = (value) => (value?.trim() ? value : '')

  const handleUpdateOrgInfo = () => {
    navigate(ROUTES.ORGANIZATIONS.VIEW.replace(':orgID', orgID), {
      state: { organizationSnapshot: snapshotData, reportID }
    })
  }

  return (
    <BCTypography variant="body4" color="text">
      {!isEditing && (
        <>
          <List
            sx={{
              listStyleType: 'disc',
              listStylePosition: 'outside',
              pl: 2.5,
              '& .MuiListItem-root': {
                display: 'list-item',
                py: 0.5,
                paddingLeft: 0
              }
            }}
          >
            {allFormFields.map(({ name, label }) => (
              <ListItem key={name} sx={{ display: 'flex' }}>
                <strong>{label}:</strong>{' '}
                <span>
                  {displayAddressValue(snapshotData[name]) ||
                    (requiredFields.includes(name) && (
                      <BCTypography variant="body4" color="error">
                        Required
                      </BCTypography>
                    ))}
                </span>
              </ListItem>
            ))}
          </List>
          {isGovernmentUser && snapshotData?.isEdited && (
            <BCButton
              variant="outlined"
              color="primary"
              onClick={handleUpdateOrgInfo}
              style={{ marginTop: '1rem' }}
            >
              {t('report:updateOrgInfo')}
            </BCButton>
          )}
        </>
      )}

      {isEditing && (
        <form onSubmit={handleSubmit(onSubmit, onError)}>
          <FormProvider {...{ control, setValue }}>
            <Stack spacing={1} mb={3}>
              {/* Regular text fields */}
              {textFormFields.slice(0, -1).map((field) => (
                <BCFormText
                  data-test={field.name}
                  key={field.name}
                  control={control}
                  label={field.label}
                  name={field.name}
                  checkbox={field.checkbox}
                  checkboxLabel={field.checkboxLabel}
                  onCheckboxChange={field.onCheckboxChange}
                  isChecked={field.isChecked}
                  disabled={field.disabled}
                />
              ))}

              {/* Address autocomplete fields */}
              {addressFormFields.map((field) => (
                <BCFormAddressAutocomplete
                  data-test={field.name}
                  key={field.name}
                  control={control}
                  label={field.label}
                  name={field.name}
                  checkbox={field.checkbox}
                  checkboxLabel={field.checkboxLabel}
                  onCheckboxChange={field.onCheckboxChange}
                  isChecked={field.isChecked}
                  disabled={field.disabled}
                  onSelectAddress={field.onSelectAddress}
                />
              ))}
              {/* Head office address */}
              <BCFormText
                data-test={headOffice.name}
                key={headOffice.name}
                control={control}
                label={headOffice.label}
                name={headOffice.name}
                checkbox={headOffice.checkbox}
                checkboxLabel={headOffice.checkboxLabel}
                onCheckboxChange={headOffice.onCheckboxChange}
                isChecked={headOffice.isChecked}
                disabled={headOffice.disabled}
              />
            </Stack>
            <Box display="flex">
              <BCButton
                type="submit"
                variant="contained"
                size="medium"
                color="primary"
                data-test="saveUser"
                isLoading={isUpdating}
                startIcon={
                  <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
                }
              >
                <BCTypography variant="button">{t('saveBtn')}</BCTypography>
              </BCButton>
              <BCButton
                type="button"
                variant="outlined"
                color="primary"
                disabled={isUpdating}
                sx={{ ml: 2 }}
                onClick={onCancel}
              >
                <BCTypography variant="subtitle2" textTransform="none">
                  {t('cancelBtn')}
                </BCTypography>
              </BCButton>
            </Box>
          </FormProvider>
        </form>
      )}
      <BCModal
        open={!!modalData}
        onClose={() => setModalData(null)}
        data={modalData}
      />
    </BCTypography>
  )
}
