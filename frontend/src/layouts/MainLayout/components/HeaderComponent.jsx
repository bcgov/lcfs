import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { numberFormatter } from '@/utils/formatters'
import Icon from '@mui/material/Icon'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export const HeaderComponent = () => {
  const { t } = useTranslation()
  const { data, isFetched } = useCurrentUser()
  const [showBalance, setShowBalance] = useState(false)

  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance) // Toggles the visibility of the balance
  }

  return (
    isFetched && (
      <>
        <BCTypography
          className="organization_name"
          variant="body1"
          align="right"
        >
          {data?.organization.name || t('govOrg')}
        </BCTypography>
        {data?.organization.organizationId && (
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
              {showBalance && (
                <div className="balance">
                  {/* TODO: Remove or 50,000 */}
                  {numberFormatter(data?.organization?.balance || '50000')}
                </div>
              )}
            </BCBox>
          </BCBox>
        )}
      </>
    )
  )
}
