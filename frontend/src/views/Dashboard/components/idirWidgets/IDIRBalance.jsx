import withRole from '@/utils/withRole'

export const IDIRBalance = (props) => <>OrganizationBalance</>

IDIRBalance.defaultProps = {
  organization: {},
  organizations: []
}

const AllowedRoles = ['Administrator']
const IDIRBalanceWithRole = withRole(IDIRBalance, AllowedRoles)

export default IDIRBalanceWithRole
