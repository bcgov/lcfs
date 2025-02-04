import { useGetChangelog } from '@/hooks/useFuelSupply'
import React from 'react'

export const FuelSupplyChangelog = () => {
  const { data } = useGetChangelog({
    complianceReportID: 7,
    selection: 'fuel-supply'
  })
  console.log(data)
  return <div>FuelSupplyChangelog</div>
}
