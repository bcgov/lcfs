export const DASHBOARD = '/';
export const DOCS = '/docs';
export const LOGIN = '/login';

export const ORGANIZATION = '/organization';
export const ORGANIZATION_USERS = `${ORGANIZATION}/users`;
export const ORGANIZATION_USER = `${ORGANIZATION_USERS}/:userID`;

export const ADMINISTRATION = '/administration';
export const ADMINISTRATION_USERS = `${ADMINISTRATION}/users`;

export const USERS = '/users';
export const CURRENT_USER = '/users/current';

export const CONTACT_US = '/contact-us';
export const VIEW_USER = `${USERS}/:userID`;
export const EDIT_USER = `${VIEW_USER}/edit`;
