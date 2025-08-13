import React, { useState } from 'react'
import { 
  Box, 
  Card, 
  CardContent, 
  TextField, 
  FormControlLabel, 
  Switch, 
  Grid,
  Collapse
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { faEdit, faSave, faTrash, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const CreditMarketForm = () => {
  const { t } = useTranslation(['common', 'creditMarket'])
  const { data: currentUser } = useCurrentUser()
  
  const [isEditing, setIsEditing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [formData, setFormData] = useState({
    contactPerson: '',
    email: '',
    phone: '',
    creditsAvailable: false
  })

  // Mock data to simulate existing listing
  const [hasExistingListing] = useState(false)

  const handleInputChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = () => {
    // TODO: Implement API call to save listing
    console.log('Saving credit market listing:', formData)
    setIsEditing(false)
    setIsExpanded(false)
    // Show success message
  }

  const handleEdit = () => {
    setIsEditing(true)
    setIsExpanded(true)
  }

  const handleRemove = () => {
    // TODO: Implement API call to remove listing
    console.log('Removing credit market listing')
    setIsExpanded(false)
    // Show confirmation dialog first
  }

  const handleAddListing = () => {
    setIsEditing(true)
    setIsExpanded(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    if (!hasExistingListing) {
      setIsExpanded(false)
    }
    // Reset form data to original values
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <BCTypography variant="h6">
            {t('creditMarket:manageListing', 'Manage Your Credit Market Listing')}
          </BCTypography>
          
          {!hasExistingListing && !isExpanded && (
            <BCButton
              variant="contained"
              color="primary"
              size="small"
              startIcon={<FontAwesomeIcon icon={faPlus} />}
              onClick={handleAddListing}
            >
              {t('creditMarket:addListing', 'Add Listing')}
            </BCButton>
          )}
          
          {hasExistingListing && !isEditing && (
            <Box display="flex" gap={1}>
              <BCButton
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<FontAwesomeIcon icon={faEdit} />}
                onClick={handleEdit}
              >
                {t('common:edit', 'Edit')}
              </BCButton>
              <BCButton
                variant="outlined"
                color="error"
                size="small"
                startIcon={<FontAwesomeIcon icon={faTrash} />}
                onClick={handleRemove}
              >
                {t('common:remove', 'Remove')}
              </BCButton>
            </Box>
          )}
        </Box>

        <Collapse in={isExpanded || hasExistingListing}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('creditMarket:contactPerson', 'Contact Person')}
                value={formData.contactPerson}
                onChange={handleInputChange('contactPerson')}
                disabled={!isEditing}
                required
                sx={{ mb: 2 }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('creditMarket:email', 'Email')}
                type="email"
                value={formData.email}
                onChange={handleInputChange('email')}
                disabled={!isEditing}
                required
                sx={{ mb: 2 }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('creditMarket:phone', 'Phone')}
                value={formData.phone}
                onChange={handleInputChange('phone')}
                disabled={!isEditing}
                required
                sx={{ mb: 2 }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.creditsAvailable}
                    onChange={handleInputChange('creditsAvailable')}
                    disabled={!isEditing}
                  />
                }
                label={t('creditMarket:creditsAvailable', 'Credits Available for Sale')}
                sx={{ mb: 2 }}
              />
            </Grid>
          </Grid>

          {isEditing && (
            <Box display="flex" gap={2} mt={2}>
              <BCButton
                variant="contained"
                color="primary"
                startIcon={<FontAwesomeIcon icon={faSave} />}
                onClick={handleSave}
              >
                {t('common:save', 'Save')}
              </BCButton>
              <BCButton
                variant="outlined"
                onClick={handleCancel}
              >
                {t('common:cancel', 'Cancel')}
              </BCButton>
            </Box>
          )}
        </Collapse>

        {!isExpanded && !hasExistingListing && (
          <BCTypography variant="body2" color="text.secondary">
            {t('creditMarket:noListingMessage', 
              'Your organization is not currently listed in the credit trading market. ' +
              'Add a listing to let other organizations know you are interested in credit trading.')}
          </BCTypography>
        )}
      </CardContent>
    </Card>
  )
}