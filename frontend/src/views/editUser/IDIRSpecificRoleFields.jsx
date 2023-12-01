import React from 'react';
import { Checkbox, FormControlLabel, Radio, RadioGroup } from '@mui/material';

export const IDIRSpecificRoleFields = ({
  formData,
  handleCheckbox,
  handleChange,
}) => {
  return (
    <>
      <FormControlLabel
        control={<Checkbox />}
        label={
          <span>
            <strong>Administrator</strong> — can add/edit IDIR users and assign
            roles and add/edit organizations, BCeID users and assign roles
          </span>
        }
        onChange={handleCheckbox}
        name="administrator"
        checked={formData.administrator}
        disabled={formData.active === 'inactive'}
      />
      <RadioGroup
        defaultValue="active"
        name="govRole"
        style={{
          gap: 16,
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
          label={
            <span>
              <strong>Analyst</strong> — can make recommendations on transfers,
              transactions and compliance reports, manage file submissions and
              add/edit fuel codes
            </span>
          }
          disabled={formData.active === 'inactive'}
        />
        <FormControlLabel
          value="compliance_manager"
          control={<Radio />}
          label={
            <span>
              <strong>Compliance Manager</strong> — can make recommendations on
              compliance reports
            </span>
          }
          disabled={formData.active === 'inactive'}
        />
        <FormControlLabel
          value="director"
          control={<Radio />}
          label={
            <span>
              <strong>Director</strong> — can assess compliance reports and
              approve transactions
            </span>
          }
          disabled={formData.active === 'inactive'}
        />
      </RadioGroup>
    </>
  );
};
