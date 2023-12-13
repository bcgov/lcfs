export const DASHBOARD = '/'
export const DOCS = '/docs'
export const LOGIN = '/login'

export const ORGANIZATION = '/organization'
export const ORGANIZATION_USERS = `${ORGANIZATION}/users`
export const ORGANIZATION_USER = `${ORGANIZATION_USERS}/:userID`

// TODO: Use 'organizations' in plural form for consistency with other routes.
export const ADD_ORGANIZATION = `${ORGANIZATION}/add`;

export const ADMINISTRATION = '/administration';
export const ADMINISTRATION_USERS = `${ADMINISTRATION}/users`;

export const USERS = '/users'
export const CURRENT_USER = `${USERS}/current`

export const CONTACT_US = '/contact-us'
export const VIEW_USER = `${USERS}/:userID`
export const EDIT_USER = `${VIEW_USER}/edit`
