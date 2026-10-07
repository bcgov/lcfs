import { useState } from 'react'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'
import { LabelBox } from '@/views/Transactions/components/LabelBox.jsx'
import DocumentTable from '@/components/Documents/DocumentTable.jsx'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'

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
        <IconButton>{isExpanded ? <ExpandLess /> : <ExpandMore />}</IconButton>
      </Box>

      <Collapse in={isExpanded}>
        <DocumentTable parentID={parentID} parentType={parentType} />
      </Collapse>
    </LabelBox>
  )
}

export default TransactionDocuments
