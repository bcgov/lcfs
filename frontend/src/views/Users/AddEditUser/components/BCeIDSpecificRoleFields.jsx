import { Checkbox, FormControlLabel, Radio, Stack } from '@mui/material'

export const BCeIDSpecificRoleFields = ({
  formData,
  handleCheckbox,
  handleReadOnlyClick
}) => {
  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={<Checkbox />}
        label={
          <span>
            <strong>Manage Users</strong> — can add/edit BCeID users and assign
            roles
          </span>
        }
        onChange={handleCheckbox}
        name="manageUsers"
        checked={formData.manageUsers}
        disabled={formData.active === 'inactive'}
      />
      <FormControlLabel
        control={<Checkbox />}
        label={
          <span>
            <strong>Transfer</strong> — can create/save transfers and submit
            files
          </span>
        }
        onChange={handleCheckbox}
        name="transfer"
        checked={formData.transfer}
        disabled={formData.active === 'inactive'}
      />
      <FormControlLabel
        control={<Checkbox />}
        label={
          <span>
            <strong>Compliance Reporting</strong> — can create/save compliance
            reports and submit files
          </span>
        }
        onChange={handleCheckbox}
        name="complianceReporting"
        checked={formData.complianceReporting}
        disabled={formData.active === 'inactive'}
      />
      <FormControlLabel
        control={<Checkbox />}
        label={
          <span>
            <strong>Signing Authority</strong> — can sign and submit compliance
            reports to government and transfers to trade partners/government
          </span>
        }
        onChange={handleCheckbox}
        name="signingAuthority"
        checked={formData.signingAuthority}
        disabled={formData.active === 'inactive'}
      />
      <FormControlLabel
        control={<Radio />}
        label={
          <span>
            <strong>Read Only</strong> — can view transactions, compliance
            reports and files
          </span>
        }
        onChange={handleReadOnlyClick}
        name="readOnly"
        checked={formData.readOnly}
        disabled={formData.active === 'inactive'}
      />
    </Stack>
  )
}
