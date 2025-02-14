import { useState } from 'react'
import { Box, Collapse, IconButton } from '@mui/material'
import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'
import ExpandLessIcon from '@mui/icons-material/ExpandLess.js'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore.js'
import { LabelBox } from '@/views/Transactions/components/LabelBox.jsx'
import DocumentTable from '@/components/Documents/DocumentTable.jsx'

function TransactionDocuments({ parentType, parentID }) {
  const { t } = useTranslation(['report'])
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <LabelBox label={t('txn:attachmentsOptional')}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        onClick={handleToggle}
        sx={{ cursor: 'pointer' }}
      >
        <BCTypography variant="body2">{t('txn:attachmentsTitle')}</BCTypography>
        <IconButton>
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={isExpanded}>
        <DocumentTable parentID={parentID} parentType={parentType} />
      </Collapse>
    </LabelBox>
  )
}

export default TransactionDocuments
