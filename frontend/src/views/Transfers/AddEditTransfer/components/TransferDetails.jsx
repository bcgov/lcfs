import React from 'react'
import {
  FormControl,
  Select,
  MenuItem,
  TextField,
  Typography
} from '@mui/material'
import BCBox from '@/components/BCBox'
import LabelBox from './LabelBox'
import { Controller } from 'react-hook-form'

const TransferDetails = ({
  register,
  errors,
  organizations,
  currentOrg,
  totalValue,
  control,
  renderError
}) => {
  return (
    <BCBox>
      <LabelBox label="Transfer Details (required)">
        <Typography variant="body1" component="div">
          {`${currentOrg?.name} transfers `}
          <TextField
            {...register('quantity')}
            placeholder="Quantity"
            size="small"
            error={!!errors.quantity}
            helperText={errors.quantity?.message}
            style={{ width: '200px', marginRight: '10px' }}
          />
          {' compliance units to '}
          <FormControl
            sx={{
              width: '350px',
              height: '40px',
              '.MuiOutlinedInput-root': {
                height: '100%'
              },
              '& .Mui-error': {
                height: '100%'
              }
            }}
          >
            <Controller
              name="toOrganizationId"
              control={control} // Note: control needs to be passed down from the parent component
              displayEmpty
              render={({ field }) => (
                <Select
                  labelId="to-organization-select-label"
                  {...field}
                  error={!!errors.toOrganizationId}
                  helperText={errors.toOrganizationId?.message}
                  displayEmpty
                  MenuProps={{
                    sx: {
                      marginTop: '0 !important'
                    }
                  }}
                  sx={{
                    height: '100% !important',
                    '.MuiSelect-select': {
                      height: '100% !important',
                      paddingTop: '0px',
                      paddingBottom: '0px'
                    }
                  }}
                  renderValue={(selected) => {
                    if (selected === "") {
                      return <em>Select an Organization</em>;
                    }
                    const selectedOrg = organizations.find(org => org.value === selected);
                    return selectedOrg ? selectedOrg.label : <em>Select an Organization</em>;
                  }}
                >
                  <MenuItem value="">
                    <em>Select an Organization</em>
                  </MenuItem>
                  {organizations.map((org) => (
                    <MenuItem key={org.value} value={org.value}>
                      {org.label}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            {renderError('toOrganizationId')}
          </FormControl>
          {' for '}
          <TextField
            {...register('pricePerUnit')}
            placeholder="The fair market value of any consideration, in CAD"
            size="small"
            error={!!errors.pricePerUnit}
            helperText={errors.pricePerUnit?.message}
            style={{ width: '375px', marginRight: '10px' }}
          />
          {' per compliance unit for a total value of '}
          <Typography
            variant="body1"
            component="span"
            color="primary"
            data-testid="transfer-total-value"
          >
            {totalValue.toLocaleString('en-CA', {
              style: 'currency',
              currency: 'CAD'
            })}
          </Typography>
          {' CAD.'}
        </Typography>
      </LabelBox>
    </BCBox>
  )
}

export default TransferDetails
