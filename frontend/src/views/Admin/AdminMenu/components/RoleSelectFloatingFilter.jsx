import React from 'react'
import { BCSelectFloatingFilter } from '@/components/BCDataGrid/components'
import { useRoleList } from '@/hooks/useRole'

export const RoleSelectFloatingFilter = (props) => {
  const { params, ...rest } = props
  const { data, isLoading } = useRoleList(params)

  return (
    <BCSelectFloatingFilter
      {...rest}
      optionsQuery={() => ({ data, isLoading })}
    />
  )
}
