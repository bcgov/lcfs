import { useAuth as useOidcAuth } from 'react-oidc-context';

export const useAuth = () => {
  const auth = useOidcAuth();

  // You might want to map the properties from auth (from react-oidc-context)
  // to what your application previously expected, or update all components.
  // For example:
  // return {
  //   keycloak: auth.user?.profile, // Or auth.user for the whole user object including tokens
  //   authenticated: auth.isAuthenticated,
  //   loading: auth.isLoading,
  //   login: () => auth.signinRedirect(),
  //   logout: () => auth.signoutRedirect(),
  //   updateToken: (minValidity) => auth.userManager.signinSilent(), // This is an example, might need more specific mapping
  //   profile: auth.user?.profile,
  //   token: auth.user?.access_token,
  //   idToken: auth.user?.id_token
  // };

  // For now, returning the direct context for components to adapt
  return auth;
};
