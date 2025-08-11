import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { AddEditOrgForm } from './AddEditOrgForm'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

export const AddEditOrg = () => {
  const { t } = useTranslation(['common', 'org'])
  const { orgID } = useParams()

  return (
    <BCWidgetCard
      id="user-card"
      title={orgID ? t('org:editOrgTitle') : t('org:addOrgTitle')}
      color="nav"
      data-test="addEditOrgContainer"
      content={<AddEditOrgForm />}
    />
  )
}
