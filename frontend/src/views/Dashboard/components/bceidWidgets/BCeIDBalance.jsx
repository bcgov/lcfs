import withRole from '@/utils/withRole'

export const BCeIDBalance = (props) => <>BCeIDBalance</>

BCeIDBalance.defaultProps = {
  organization: {},
  organizations: []
}

const AllowedRoles = ['Transfer']
const BCeIDBalanceWithRole = withRole(BCeIDBalance, AllowedRoles)

export default BCeIDBalanceWithRole
