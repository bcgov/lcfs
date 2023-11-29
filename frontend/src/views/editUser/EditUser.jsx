import React, { useState } from 'react';
import {
  TextField,
  Typography,
  Stack,
  FormHelperText,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
} from '@mui/material';
import colors from '@/assets/theme/base/colors';
import Grid2 from '@mui/material/Unstable_Grid2/Grid2';
import BCButton from '../../components/BCButton';
import ArrowRight from '@/assets/icons/arrow-right.svg';
import Save from '@/assets/icons/save.svg';
import { useMutation } from 'react-query';
import { useNavigate } from 'react-router-dom';
import * as routes from '@/constants/routes'

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
    mobile: '',
  },
  gov: true,
  orgName: 'Fuel Supplier Canada Ltd.',
};

// Possibly move this out to its own component if it is going to be used elsewhere
const Label = ({children, ...rest}) => (
  <Typography fontSize={16} fontWeight={600} component={'label'} {...rest}>{children}</Typography>
)

export const EditUser = ({userType = 'idir'}) => {
  const navigate = useNavigate();
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
    IDIRUserName: '',
  });

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

  const handleSave = async e => {
    e.preventDefault();
    // do something with data before saving?
    // save(formData);
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (e) => {
    const {value} = e.target
    if(value === 'active') {
      setFormData(prev => ({...prev, active: value}))
    }
    if(value === 'inactive') {
      setFormData(prev => ({...prev, active: value, readOnly: false, manageUsers: false, transfer: false, complianceReporting: false, signingAuthority: false, administrator: false, govRole: ''}))
    }
  }

  const handleCheckbox = e => {
    const { checked, name } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked, readOnly: false }));
  };

  const handleBackClick = () => {
    if(userType === 'idir') {
      navigate(routes.VIEW_USER)
    }
    if(userType === 'bceid') {
      navigate(routes.ORGANIZATION_USER)
    }
  }

  const handleReadOnlyClick = () => {
    setFormData(prev => ({...prev, manageUsers: false, transfer: false, complianceReporting: false, signingAuthority: false, readOnly: true}))
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
              <Label htmlFor='firstName'>First Name</Label>
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
              <Label htmlFor='lastName'>Last Name</Label>
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
              <Label htmlFor='jobTitle'>Job Title</Label>
              <TextField
                fullWidth
                required
                error={!!dummy.errors.jobTitle}
                name="jobTitle"
                onChange={handleChange}
                value={formData.jobTitle}
                id='jobTitle'
              />
              {dummy.errors.jobTitle && (
                <FormHelperText error>{dummy.errors.jobTitle}</FormHelperText>
              )}
            </div>
            {userType === 'idir' ? (
              <>
                <div>
                  <Label htmlFor='IDIRUserName'>IDIR User Name</Label>
                  <TextField
                    fullWidth
                    required
                    error={!!dummy.errors.IDIRUserName}
                    name="IDIRUserName"
                    onChange={handleChange}
                    value={formData.IDIRUserName}
                    id='IDIRUserName'
                  />
                  {dummy.errors.IDIRUserName && (
                    <FormHelperText error>
                      {dummy.errors.IDIRUserName}
                    </FormHelperText>
                  )}
                </div>
                <div>
                  <Label htmlFor='email'>Email address</Label>
                  <TextField
                    fullWidth
                    required
                    error={!!dummy.errors.email}
                    name="email"
                    onChange={handleChange}
                    value={formData.email}
                    id="email"
                  />
                  {dummy.errors.email && (
                    <FormHelperText error>{dummy.errors.email}</FormHelperText>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor='BCeIDUserID'>BCeID Userid</Label>
                  <TextField
                    fullWidth
                    required
                    error={!!dummy.errors.BCeIDUserID}
                    name="BCeIDUserID"
                    onChange={handleChange}
                    value={formData.BCeIDUserID}
                    id="BCeIDUserID"
                  />
                  {dummy.errors.BCeIDUserID && (
                    <FormHelperText error>
                      {dummy.errors.BCeIDUserID}
                    </FormHelperText>
                  )}
                </div>

                <div>
                  <Label htmlFor='email'>
                    Email address associated with the BCeID user account
                  </Label>
                  <TextField
                    fullWidth
                    required
                    error={!!dummy.errors.email}
                    name="email"
                    onChange={handleChange}
                    value={formData.email}
                    id="email"
                  />
                  {dummy.errors.email && (
                    <FormHelperText error>{dummy.errors.email}</FormHelperText>
                  )}
                </div>
                <div>
                  <Label htmlFor='altEmail'>
                    Alternate email for notifications <span style={{fontWeight: 'normal'}}>(optional)</span>
                  </Label>
                  <TextField
                    fullWidth
                    required
                    error={!!dummy.errors.altEmail}
                    name="altEmail"
                    onChange={handleChange}
                    value={formData.altEmail}
                    id="altEmail"
                  />
                  {dummy.errors.altEmail && (
                    <FormHelperText error>
                      {dummy.errors.altEmail}
                    </FormHelperText>
                  )}
                </div>
              </>
            )}

            <div>
              <Label htmlFor='phone'>Phone <span style={{fontWeight: 'normal'}}>(optional)</span></Label>
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
              <Label htmlFor='mobile'>Mobile Phone <span style={{fontWeight: 'normal'}}>(optional)</span></Label>
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
                gap: 8,
              }}
              onClick={handleBackClick}
            >
              <ArrowRight />
              Back
            </BCButton>
            <BCButton
              variant="contained"
              color="dark"
              style={{
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
              onClick={handleSave}
            >
              <Save />
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
                  marginTop: 8,
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
                <>
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Administrator — can add/edit IDIR users and assign roles and add/edit organizations, BCeID users and assign roles"
                    onChange={handleCheckbox}
                    name="administrator"
                    checked={formData.administrator}
                    disabled={formData.active === 'inactive'}
                  />
                  <RadioGroup
                    defaultValue="active"
                    name="govRole"
                    style={{
                      gap: 8,
                      marginTop: 8,
                    }}
                    onChange={handleChange}
                    value={formData.govRole}
                  >
                    <FormControlLabel
                      value="analyst"
                      control={<Radio />}
                      style={{
                        '.MuiFormControlLabel-label': {
                          fontSize: 16,
                        },
                      }}
                      label="Analyst — can make recommendations on transfers, transactions and compliance reports, manage file submissions and add/edit fuel codes"
                      disabled={formData.active === 'inactive'}
                    />
                    <FormControlLabel
                      value="compliance_manager"
                      control={<Radio />}
                      label="Compliance Manager — can make recommendations on compliance reports"
                      disabled={formData.active === 'inactive'}
                    />
                    <FormControlLabel
                      value="director"
                      control={<Radio />}
                      label="Director — can assess compliance reports and approve transactions"
                      disabled={formData.active === 'inactive'}
                    />
                  </RadioGroup>
                </>
              ) : (
                <Stack spacing={1}>
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Manage Users — can add/edit BCeID users and assign roles"
                    onChange={handleCheckbox}
                    name="manageUsers"
                    checked={formData.manageUsers}
                    disabled={formData.active === 'inactive'}
                  />
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Transfer — can create/save transfers and submit files"
                    onChange={handleCheckbox}
                    name="transfer"
                    checked={formData.transfer}
                    disabled={formData.active === 'inactive'}
                  />
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Compliance Reporting — can create/save compliance reports and submit files"
                    onChange={handleCheckbox}
                    name="complianceReporting"
                    checked={formData.complianceReporting}
                    disabled={formData.active === 'inactive'}
                  />
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Signing Authority — can sign and submit compliance reports to government and transfers to trade partners/government"
                    onChange={handleCheckbox}
                    name="signingAuthority"
                    checked={formData.signingAuthority}
                    disabled={formData.active === 'inactive'}
                  />
                  <FormControlLabel
                    control={<Radio />}
                    label="Read Only — can view transactions, compliance reports and files"
                    onChange={handleReadOnlyClick}
                    name="readOnly"
                    checked={formData.readOnly}
                    disabled={formData.active === 'inactive'}
                  />
                </Stack>
              )}
            </Box>
          </Stack>
        </Grid2>
      </Grid2>
    </div>
  );
};
