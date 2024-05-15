export const userData = {
  userProfileId: 2,
  keycloakUsername: 'mockuser2',
  keycloakEmail: 'test@test.com',
  organizationId: null,
  email: 'test@test.com',
  firstName: 'Test',
  lastName: 'User2',
  isActive: true
}
export const govUser = {
  userProfileId: 1,
  keycloakUsername: 'mockUser1',
  keycloakEmail: 'test@test.com',
  email: 'test@test.com',
  title: 'Tester',
  phone: '1234567890',
  firstName: 'Test',
  lastName: 'User1',
  isActive: true,
  mobilePhone: '1234567890',
  organization: null,
  roles: [
    {
      roleId: 1,
      name: 'Government',
      description: 'Identifies a government user in the system.',
      displayOrder: 1,
      isGovernmentRole: true
    },
    {
      roleId: 3,
      name: 'Administrator',
      description:
        'Can add/edit IDIR users and assign roles, add/edit organizations, BCeID users, and assign roles',
      displayOrder: 3,
      isGovernmentRole: true
    }
  ],
  isGovernmentUser: true
}
