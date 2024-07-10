import React, { useState, useRef } from 'react'
import BCButton from '@/components/BCButton'
import { Menu, MenuItem } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { faPlus, faCaretDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const AddRowsButton = ({ gridApi, complianceReportId }) => {
  const [anchorEl, setAnchorEl] = useState(null)
  const buttonRef = useRef(null)
  const { t } = useTranslation()

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleAddRows = (option) => {
    const rows = []
    while (option > 0) {
      rows.push({ id: uuid(), complianceReportId })
      option--
    }
    gridApi?.applyTransaction({ add: rows })
    setAnchorEl(null)
  }

  return (
    <div>
      <BCButton
        ref={buttonRef}
        variant="outlined"
        color="dark"
        size="small"
        startIcon={<FontAwesomeIcon icon={faPlus} className="small-icon" />}
        endIcon={<FontAwesomeIcon icon={faCaretDown} className="small-icon" />}
        onClick={handleClick}
      >
        {t('otherUses:addRow')}
      </BCButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        slotProps={{
          paper: {
            style: {
              width: buttonRef.current?.offsetWidth
            }
          }
        }}
      >
        <MenuItem onClick={() => handleAddRows(1)}>1 row</MenuItem>
        <MenuItem onClick={() => handleAddRows(5)}>
          5 {t('otherUses:rows')}
        </MenuItem>
        <MenuItem onClick={() => handleAddRows(10)}>
          10 {t('otherUses:rows')}
        </MenuItem>
      </Menu>
    </div>
  )
}

AddRowsButton.displayName = 'AddRowsButton'
