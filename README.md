# lcfs
An online application for fuel suppliers to manage their compliance obligations under the Low Carbon Fuels Act

### Auth
For authentication, we are using Keycloak as an identity broker. Different Keycloak instances exist for each environment (dev, test, prod) and these are managed by an external team. Both single sign on and single logout are supported.

The frontend of this app interacts directly with Keycloak; if the user authenticates successfully via the frontend, any request sent to our backend api should have a keycloak token attached to it, and the api should independently check whether the token is valid.