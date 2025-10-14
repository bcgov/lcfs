import React, { useRef, useState } from 'react'
import { Box, Alert } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faUpload } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import BCButton from '@/components/BCButton'

export const ExcelUpload = ({ 
  onDataParsed, 
  chargingSites = [], 
  organizations = [], 
  levels = [], 
  endUseTypes = [] 
}) => {
  const { t } = useTranslation(['chargingEquipment', 'common'])
  const fileInputRef = useRef(null)
  const [uploadError, setUploadError] = useState('')

  const downloadTemplate = () => {
    // Create template data with headers and sample row
    const templateData = [
      {
        'Charging Site': chargingSites[0]?.site_name || 'Example Site',
        'Allocating Organization': organizations[0]?.legal_name || organizations[0]?.name || 'Optional',
        'Serial Number': 'ABC123456',
        'Manufacturer': 'Example Manufacturer',
        'Model': 'Model X',
        'Level of Equipment': levels[0]?.name || 'Level 3 - Direct Current',
        'Ports': 'Single port',
        'Intended Uses': 'Public,Private',
        'Notes': 'Optional notes'
      }
    ]

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(templateData)

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'FSE Template')

    // Generate and download the file
    XLSX.writeFile(wb, 'FSE_Upload_Template.xlsx')
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    setUploadError('')

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        // Transform Excel data to match our schema
        const transformedData = jsonData.map((row, index) => {
          // Find matching charging site
          const chargingSite = chargingSites.find(site => 
            site.site_name === row['Charging Site']
          )
          
          // Find matching organization
          const organization = organizations.find(org => 
            (org.legal_name || org.name) === row['Allocating Organization']
          )

          // Find matching level
          const level = levels.find(l => 
            l.name === row['Level of Equipment']
          )

          // Parse intended uses
          const intendedUseIds = []
          if (row['Intended Uses']) {
            const useNames = row['Intended Uses'].split(',').map(s => s.trim())
            useNames.forEach(useName => {
              const useType = endUseTypes.find(type => type.type === useName)
              if (useType) {
                intendedUseIds.push(useType.end_use_type_id)
              }
            })
          }

          return {
            id: Date.now() + index, // Temporary ID
            charging_site_id: chargingSite?.charging_site_id || '',
            allocating_organization_id: organization?.organization_id || '',
            serial_number: row['Serial Number'] || '',
            manufacturer: row['Manufacturer'] || '',
            model: row['Model'] || '',
            level_of_equipment_id: level?.level_of_equipment_id || '',
            ports: row['Ports'] || 'Single port',
            intended_use_ids: intendedUseIds,
            notes: row['Notes'] || '',
            // Add validation flags
            _errors: {
              charging_site_id: !chargingSite ? 'Charging site not found' : '',
              level_of_equipment_id: !level ? 'Level of equipment not found' : '',
              serial_number: !row['Serial Number'] ? 'Serial number is required' : '',
              manufacturer: !row['Manufacturer'] ? 'Manufacturer is required' : ''
            }
          }
        })

        onDataParsed(transformedData)
        
        // Clear the input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }

      } catch (error) {
        setUploadError('Error parsing Excel file. Please check the format and try again.')
        console.error('Excel parsing error:', error)
      }
    }

    reader.readAsArrayBuffer(file)
  }

  return (
    <Box display="flex" gap={2} alignItems="center" mb={2}>
      <BCButton
        variant="outlined"
        color="primary"
        size="small"
        startIcon={<FontAwesomeIcon icon={faDownload} />}
        onClick={downloadTemplate}
      >
        {t('common:downloadTemplate')}
      </BCButton>
      
      <BCButton
        variant="contained"
        color="primary"
        size="small"
        component="label"
        startIcon={<FontAwesomeIcon icon={faUpload} />}
      >
        {t('common:uploadFile')}
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
        />
      </BCButton>

      {uploadError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {uploadError}
        </Alert>
      )}
    </Box>
  )
}
