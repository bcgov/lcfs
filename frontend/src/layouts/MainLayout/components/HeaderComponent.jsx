import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Icon from '@mui/material/Icon'
import { useState } from 'react'

export const HeaderComponent = (props) => {
  const [showBalance, setShowBalance] = useState(false)
  const { data } = props
  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance) // Toggles the visibility of the balance
  }

  return (
    <>
      <BCTypography className="organization_name" variant="body1" align="right">
        {data.organizationName}
      </BCTypography>
      <BCBox component="div" className="organization_balance">
        Balance:{' '}
        <BCBox
          component="div"
          sx={{ display: 'inline-flex', alignItems: 'center' }}
        >
          <Icon
            style={{
              fontSize: 20,
              cursor: 'pointer',
              margin: '5px',
              height: '26px'
            }}
            onClick={toggleBalanceVisibility}
          >
            {showBalance ? 'visibility' : 'visibility_off'}
          </Icon>
          {showBalance && <div className="balance">{data.balance}</div>}
        </BCBox>
      </BCBox>
    </>
  )
}
