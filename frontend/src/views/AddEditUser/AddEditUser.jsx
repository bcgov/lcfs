import colors from '@/themes/base/colors'
import BCButton from '@/components/BCButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import {
  Box,
  FormControlLabel,
  FormHelperText,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Label } from './Label'
import { IDIRSpecificFormFields } from './IDIRSpecificFormFields'
import { BCeIDSpecificFormFields } from './BCeIDSpecificFormFields'
import { BCeIDSpecificRoleFields } from './BCeIDSpecificRoleFields'
import { IDIRSpecificRoleFields } from './IDIRSpecificRoleFields'

const dummy = {
  errors: {
    firstName: '',
    lastName: 'Example Last Name error text',
    jobTitle: '',
    IDIRUserName: '',
    BCeIDUserID: '',
    email: '',
    altEmail: '',
    phone: '',
    mobile: ''
  },
  gov: true,
  orgName: 'Fuel Supplier Canada Ltd.'
}

// switch between 'idir' and 'bceid'
export const AddEditUser = ({ userType = 'bceid', edit = false }) => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    userType,
    active: 'active',
    administrator: false,
    govRole: '',
    manageUsers: false,
    transfer: false,
    complianceReporting: false,
    signingAuthority: false,
    readOnly: false,
    firstName: '',
    lastName: '',
    jobTitle: '',
    BCeIDUserID: '',
    email: '',
    altEmail: '',
    phone: '',
    mobile: '',
    IDIRUserName: ''
  })

  //   const { mutate: save } = useMutation({
  //     mutationsFn: async (data) => await apiService.put(`/users/${userID}`, data),
  //     onSuccess: async () => {
  //         // on success navigate somewhere
  //         navigate('ROUTE_HERE')
  //     },
  //     onError: async () => {
  //         // handle axios errors here
  //     },
  //   });

  const handleSave = async (e) => {
    e.preventDefault()
    // do something with data before saving?
    if (edit) {
      // find user and update
    } else {
      // save as new user
      // get org id from either url or context and save user to the org
    }
    // save(formData);
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleStatusChange = (e) => {
    const { value } = e.target
    if (value === 'active') {
      setFormData((prev) => ({ ...prev, active: value }))
    }
    if (value === 'inactive') {
      setFormData((prev) => ({
        ...prev,
        active: value,
        readOnly: false,
        manageUsers: false,
        transfer: false,
        complianceReporting: false,
        signingAuthority: false,
        administrator: false,
        govRole: ''
      }))
    }
  }

  const handleCheckbox = (e) => {
    const { checked, name } = e.target
    setFormData((prev) => ({ ...prev, [name]: checked, readOnly: false }))
  }

  const handleBackClick = () => {
    // if (userType === 'idir') {
    //   navigate(routes.VIEW_USER)
    // }
    // if (userType === 'bceid') {
    //   navigate(routes.ORGANIZATION_USER)
    // }
    // should probably not be a specific route to navigate to as more than 1 page can lead to this page. instead navigate to previous page
    navigate(-1)
  }

  const handleReadOnlyClick = () => {
    setFormData((prev) => ({
      ...prev,
      manageUsers: false,
      transfer: false,
      complianceReporting: false,
      signingAuthority: false,
      readOnly: true
    }))
  }

  return (
    <div>
      <Typography variant="h4" color={colors.primary.main} mb={2}>
        Add/Edit User {userType === 'bceid' && `to ${dummy.orgName}`}
      </Typography>
      <Grid2 container columnSpacing={2.5} rowSpacing={3.5}>
        <Grid2 xs={12} md={5} lg={4}>
          <Stack bgcolor={colors.background.grey} p={3} spacing={2} mb={3}>
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <TextField
                fullWidth
                required
                error={!!dummy.errors.firstName}
                name="firstName"
                onChange={handleChange}
                value={formData.firstName}
                id="firstName"
              />
              {dummy.errors.firstName && (
                <FormHelperText error>{dummy.errors.firstName}</FormHelperText>
              )}
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <TextField
                fullWidth
                required
                error={!!dummy.errors.lastName}
                name="lastName"
                onChange={handleChange}
                value={formData.lastName}
                id="lastName"
              />
              {dummy.errors.lastName && (
                <FormHelperText error>{dummy.errors.lastName}</FormHelperText>
              )}
            </div>
            <div>
              <Label htmlFor="jobTitle">Job Title</Label>
              <TextField
                fullWidth
                required
                error={!!dummy.errors.jobTitle}
                name="jobTitle"
                onChange={handleChange}
                value={formData.jobTitle}
                id="jobTitle"
              />
              {dummy.errors.jobTitle && (
                <FormHelperText error>{dummy.errors.jobTitle}</FormHelperText>
              )}
            </div>
            {userType === 'idir' ? (
              <IDIRSpecificFormFields
                formData={formData}
                handleChange={handleChange}
                errors={dummy.errors}
              />
            ) : (
              <BCeIDSpecificFormFields
                formData={formData}
                handleChange={handleChange}
                errors={dummy.errors}
              />
            )}

            <div>
              <Label htmlFor="phone">
                Phone <span style={{ fontWeight: 'normal' }}>(optional)</span>
              </Label>
              <TextField
                fullWidth
                error={!!dummy.errors.phone}
                name="phone"
                onChange={handleChange}
                value={formData.phone}
                id="phone"
              />
              {dummy.errors.phone && (
                <FormHelperText error>{dummy.errors.phone}</FormHelperText>
              )}
            </div>
            <div>
              <Label htmlFor="mobile">
                Mobile Phone{' '}
                <span style={{ fontWeight: 'normal' }}>(optional)</span>
              </Label>
              <TextField
                fullWidth
                error={!!dummy.errors.mobile}
                name="mobile"
                onChange={handleChange}
                value={formData.mobile}
                id="mobile"
              />
              {dummy.errors.mobile && (
                <FormHelperText error>{dummy.errors.mobile}</FormHelperText>
              )}
            </div>
          </Stack>
          <Box
            bgcolor={colors.background.grey}
            p={3}
            display="flex"
            justifyContent="space-between"
          >
            <BCButton
              variant="outlined"
              color="dark"
              style={{
                background: 'white',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
              }}
              onClick={handleBackClick}
            >
              <ArrowBackIcon />
              Back
            </BCButton>
            <BCButton
              variant="contained"
              color="dark"
              style={{
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
              }}
              onClick={handleSave}
            >
              <SaveIcon />
              Save
            </BCButton>
          </Box>
        </Grid2>
        <Grid2 xs={12} md={7} lg={6}>
          <Stack bgcolor={colors.background.grey} p={3} spacing={2} mb={3}>
            <Box>
              <Typography mb={1.5}>Status</Typography>
              <RadioGroup
                defaultValue="active"
                style={{
                  gap: 8,
                  marginTop: 8
                }}
                value={formData.active}
                name="active"
                onChange={handleStatusChange}
              >
                <FormControlLabel
                  value="active"
                  control={<Radio />}
                  label="Active, user can login to LCFS"
                />
                <FormControlLabel
                  value="inactive"
                  control={<Radio />}
                  label="Inactive, user cannot login to LCFS"
                />
              </RadioGroup>
            </Box>
            <Box>
              <Typography mb={1.5}>Roles</Typography>
              {userType === 'idir' ? (
                <IDIRSpecificRoleFields
                  formData={formData}
                  handleCheckbox={handleCheckbox}
                  handleChange={handleChange}
                />
              ) : (
                <BCeIDSpecificRoleFields
                  formData={formData}
                  handleCheckbox={handleCheckbox}
                  handleReadOnlyClick={handleReadOnlyClick}
                />
              )}
            </Box>
          </Stack>
        </Grid2>
      </Grid2>
    </div>
  )
}
