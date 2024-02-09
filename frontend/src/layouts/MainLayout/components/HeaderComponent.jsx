import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Icon from '@mui/material/Icon'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export const HeaderComponent = (props) => {
  const { t } = useTranslation()
  const [showBalance, setShowBalance] = useState(false)
  const { data } = props
  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance) // Toggles the visibility of the balance
  }

  return (
    <>
      <BCTypography className="organization_name" variant="body1" align="right">
        {data.organizationName || t('govOrg')}
      </BCTypography>
      {data.organizationLogo && (
        <BCBox component="div" className="organization_balance">
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
            {t('balance')}:&nbsp;&nbsp;
            {showBalance && <div className="balance">{data.balance}</div>}
          </BCBox>
        </BCBox>
      )}
    </>
  )
}
