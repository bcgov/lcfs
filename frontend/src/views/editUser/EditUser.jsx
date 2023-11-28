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
  gov: false,
  orgName: 'Fuel Supplier Canada Ltd.',
};

export const EditUser = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    isGov: dummy.gov,
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

  const handleCheckbox = e => {
    const { checked, name } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  return (
    <div>
      <Typography variant="h4" color={colors.primary.main} mb={2}>
        Add/Edit User {!dummy.gov && `to ${dummy.orgName}`}
      </Typography>
      <Grid2 container columnSpacing={2.5} rowSpacing={3.5}>
        <Grid2 xs={12} md={5} lg={4}>
          <Stack bgcolor={colors.background.grey} p={3} spacing={2} mb={3}>
            <div>
              <Typography fontSize={16}>First Name</Typography>
              <TextField
                fullWidth
                required
                error={!!dummy.errors.firstName}
                name="firstName"
                onChange={handleChange}
                value={formData.firstName}
              />
              {dummy.errors.firstName && (
                <FormHelperText error>{dummy.errors.firstName}</FormHelperText>
              )}
            </div>
            <div>
              <Typography fontSize={16}>Last Name</Typography>
              <TextField
                fullWidth
                required
                error={!!dummy.errors.lastName}
                name="lastName"
                onChange={handleChange}
                value={formData.lastName}
              />
              {dummy.errors.lastName && (
                <FormHelperText error>{dummy.errors.lastName}</FormHelperText>
              )}
            </div>
            <div>
              <Typography fontSize={16}>Job Title</Typography>
              <TextField
                fullWidth
                required
                error={!!dummy.errors.jobTitle}
                name="jobTitle"
                onChange={handleChange}
                value={formData.jobTitle}
              />
              {dummy.errors.jobTitle && (
                <FormHelperText error>{dummy.errors.jobTitle}</FormHelperText>
              )}
            </div>
            {dummy.gov ? (
              <>
                <div>
                  <Typography fontSize={16}>IDIR User Name</Typography>
                  <TextField
                    fullWidth
                    required
                    error={!!dummy.errors.IDIRUserName}
                    name="IDIRUserName"
                    onChange={handleChange}
                    value={formData.IDIRUserName}
                  />
                  {dummy.errors.IDIRUserName && (
                    <FormHelperText error>
                      {dummy.errors.IDIRUserName}
                    </FormHelperText>
                  )}
                </div>
                <div>
                  <Typography fontSize={16}>Email address</Typography>
                  <TextField
                    fullWidth
                    required
                    error={!!dummy.errors.email}
                    name="email"
                    onChange={handleChange}
                    value={formData.email}
                  />
                  {dummy.errors.email && (
                    <FormHelperText error>{dummy.errors.email}</FormHelperText>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <Typography fontSize={16}>BCeID Userid</Typography>
                  <TextField
                    fullWidth
                    required
                    error={!!dummy.errors.BCeIDUserID}
                    name="BCeIDUserID"
                    onChange={handleChange}
                    value={formData.BCeIDUserID}
                  />
                  {dummy.errors.BCeIDUserID && (
                    <FormHelperText error>
                      {dummy.errors.BCeIDUserID}
                    </FormHelperText>
                  )}
                </div>

                <div>
                  <Typography fontSize={16}>
                    Email address associated with the BCeID user account
                  </Typography>
                  <TextField
                    fullWidth
                    required
                    error={!!dummy.errors.email}
                    name="email"
                    onChange={handleChange}
                    value={formData.email}
                  />
                  {dummy.errors.email && (
                    <FormHelperText error>{dummy.errors.email}</FormHelperText>
                  )}
                </div>
                <div>
                  <Typography fontSize={16}>
                    Alternate email for notifications (optional)
                  </Typography>
                  <TextField
                    fullWidth
                    required
                    error={!!dummy.errors.altEmail}
                    name="altEmail"
                    onChange={handleChange}
                    value={formData.altEmail}
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
              <Typography fontSize={16}>Phone (optional)</Typography>
              <TextField
                fullWidth
                error={!!dummy.errors.phone}
                name="phone"
                onChange={handleChange}
                value={formData.phone}
              />
              {dummy.errors.phone && (
                <FormHelperText error>{dummy.errors.phone}</FormHelperText>
              )}
            </div>
            <div>
              <Typography fontSize={16}>Mobile Phone (optional)</Typography>
              <TextField
                fullWidth
                error={!!dummy.errors.mobile}
                name="mobile"
                onChange={handleChange}
                value={formData.mobile}
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
              onClick={() => navigate(-1)}
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
                onChange={handleChange}
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
              {dummy.gov ? (
                <>
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Administrator — can add/edit IDIR users and assign roles and add/edit organizations, BCeID users and assign roles"
                    onChange={handleCheckbox}
                    name="administrator"
                    checked={formData.administrator}
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
                    />
                    <FormControlLabel
                      value="compliance_manager"
                      control={<Radio />}
                      label="Compliance Manager — can make recommendations on compliance reports"
                    />
                    <FormControlLabel
                      value="director"
                      control={<Radio />}
                      label="Director — can assess compliance reports and approve transactions"
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
                  />
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Transfer — can create/save transfers and submit files"
                    onChange={handleCheckbox}
                    name="transfer"
                    checked={formData.transfer}
                  />
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Compliance Reporting — can create/save compliance reports and submit files"
                    onChange={handleCheckbox}
                    name="complianceReporting"
                    checked={formData.complianceReporting}
                  />
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Signing Authority — can sign and submit compliance reports to government and transfers to trade partners/government"
                    onChange={handleCheckbox}
                    name="signingAuthority"
                    checked={formData.signingAuthority}
                  />
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Read Only — can view transactions, compliance reports and files"
                    onChange={handleCheckbox}
                    name="readOnly"
                    checked={formData.readOnly}
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
