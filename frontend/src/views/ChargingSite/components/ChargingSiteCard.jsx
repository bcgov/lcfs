import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ChargingSiteProfile } from './ChargingSiteProfile'
import BCBox from '@/components/BCBox'

export const ChargingSiteCard = () => {
  const { t } = useTranslation('chargingSite')
  const { currentUser, hasRoles } = useCurrentUser()
  return (
    <BCBox
      sx={{
        mt: 5,
        width: {
          md: '100%',
          lg: '60%'
        }
      }}
    >
      <BCWidgetCard
        title={t('cardTitle')}
        color="nav"
        editButton={undefined}
        content={<ChargingSiteProfile />}
      />
    </BCBox>
  )
}
