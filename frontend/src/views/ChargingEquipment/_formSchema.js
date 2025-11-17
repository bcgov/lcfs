import * as yup from 'yup'

export const chargingEquipmentSchema = yup.object().shape({
  charging_site_id: yup
    .number()
    .required('Charging site is required')
    .positive('Please select a valid charging site'),

  serial_number: yup
    .string()
    .required('Serial number is required')
    .min(1, 'Serial number must be at least 1 character')
    .max(100, 'Serial number must be less than 100 characters')
    .trim(),
    
  manufacturer: yup
    .string()
    .required('Manufacturer is required')
    .min(1, 'Manufacturer must be at least 1 character')
    .max(100, 'Manufacturer must be less than 100 characters')
    .trim(),
    
  model: yup
    .string()
    .max(100, 'Model must be less than 100 characters')
    .trim()
    .nullable(),
    
  level_of_equipment_id: yup
    .number()
    .required('Level of equipment is required')
    .positive('Please select a valid level of equipment'),
    
  ports: yup
    .string()
    .oneOf(['Single port', 'Dual port'], 'Please select a valid port configuration')
    .nullable(),
    
  notes: yup
    .string()
    .nullable()
    .optional(),
    
  intended_use_ids: yup
    .array()
    .of(yup.number().positive())
    .min(1, 'At least one intended use is required')
    .required('Intended uses are required'),

  intended_user_ids: yup
    .array()
    .of(yup.number().positive())
    .min(1, 'At least one intended user is required')
    .required('Intended users are required')
})