# Custom React Hooks

This page documents commonly used custom React Hooks within the LCFS frontend application. Custom hooks are a way to extract component logic into reusable functions. This addresses requirements for ticket #2410 and is based on the original "10. Custom Hooks" wiki page if such content existed (though it was only listed as a title).

## 1. Purpose of Custom Hooks

*   **Share Logic**: Reuse stateful logic between multiple components without resorting to higher-order components or render props.
*   **Simplify Components**: Keep component code cleaner and focused on rendering by extracting complex logic.
*   **Improve Readability**: Make logic easier to follow and understand.
*   **Facilitate Testing**: Custom hooks can often be tested in isolation.

## 2. Location

Custom hooks are typically located in the `frontend/src/hooks/` directory.

## 3. Naming Convention

Custom hooks should always be prefixed with `use` (e.g., `useUserData`, `useFormValidation`, `useApiService`).

## 4. Common Custom Hooks (Examples & Placeholders)

*(This section should be populated by identifying and documenting actual custom hooks from `frontend/src/hooks/`. Below are common patterns and examples based on the project's library usage.)*

### 4.1. API Service Hook (`useApiService` or similar)

Many applications create a custom hook to encapsulate `axios` instance creation, including base URL, default headers, and potentially interceptors for token refresh or global error handling.

```javascript
// frontend/src/hooks/useApiService.js (Conceptual Example)
import axios from 'axios';
import { useKeycloak } from '@react-keycloak/web'; // If Keycloak token is needed

// Define your API base URL (ideally from an environment variable)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const useApiService = () => {
  const { keycloak, initialized } = useKeycloak();

  const client = axios.create({
    baseURL: API_BASE_URL,
  });

  // Add a request interceptor to include the auth token
  client.interceptors.request.use(
    (config) => {
      if (initialized && keycloak.token) {
        config.headers.Authorization = `Bearer ${keycloak.token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Optional: Add response interceptor for token refresh or global error handling
  // client.interceptors.response.use(...);

  return { client };
};
```
**Usage**: Components or other hooks (like React Query hooks) would then use this `useApiService` to get a pre-configured `axios` client.

### 4.2. React Query Hooks (Data Fetching & Mutations)

As shown in [Libraries and Their Common Uses](Libraries-and-Their-Common-Uses.md#2-react-query-tanstackreact-query-server-state-management), custom hooks are the standard way to wrap `useQuery` and `useMutation` calls from React Query.

**Example: `useFetchCurrentUser`** (from previous doc)
```javascript
// frontend/src/hooks/useUserData.js (Example)
import { useQuery } from '@tanstack/react-query';
import { useApiService } from '@/services/useApiService'; // Corrected path from example

const USER_QUERY_KEY = 'currentUser';

export const useFetchCurrentUser = (options) => {
  const { client } = useApiService();
  return useQuery({
    queryKey: [USER_QUERY_KEY],
    queryFn: async () => {
      const response = await client.get('/users/me'); // Ensure endpoint exists
      return response.data;
    },
    staleTime: 5 * 60 * 1000, 
    ...options,
  });
};
```

**Example: `useUpdateUserProfile`** (from previous doc)
```javascript
// frontend/src/hooks/useUserData.js (Continued)
import { useMutation, useQueryClient } from '@tanstack/react-query';
// import { useApiService } from '@/services/useApiService'; // Already imported

export const useUpdateUserProfile = (options) => {
  const { client } = useApiService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData) => {
      const response = await client.put('/users/profile', userData); // Ensure endpoint exists
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [USER_QUERY_KEY] });
      // Optionally: queryClient.setQueryData([USER_QUERY_KEY], data);
    },
    ...options,
  });
};
```

### 4.3. Form Handling Hooks (e.g., `useComplexFormLogic`)

If a form has particularly complex stateful logic beyond what `react-hook-form` handles directly, or involves multiple related state pieces specific to that form's domain, a custom hook can encapsulate this.

```javascript
// frontend/src/hooks/useSpecificFormManagement.js (Conceptual)
import { useState, useCallback } from 'react';

export const useSpecificFormManagement = (initialValues) => {
  const [customField, setCustomField] = useState(initialValues.customField || '');
  // ... other specific form-related states ...

  const handleCustomFieldChange = useCallback((value) => {
    // ... custom logic ...
    setCustomField(value);
  }, []);

  return {
    customField,
    handleCustomFieldChange,
    // ... other exposed values and handlers ...
  };
};
```

### 4.4. UI Interaction Hooks (e.g., `useModalState`, `useToggle`)

Simple hooks to manage common UI states like modal visibility or toggle states.

```javascript
// frontend/src/hooks/useToggle.js
import { useState, useCallback } from 'react';

export const useToggle = (initialState = false) => {
  const [isOn, setIsOn] = useState(initialState);
  const toggle = useCallback(() => setIsOn(prev => !prev), []);
  const setOn = useCallback(() => setIsOn(true), []);
  const setOff = useCallback(() => setIsOn(false), []);
  return { isOn, toggle, setOn, setOff };
};
```

### 4.5. Window/Browser API Hooks (e.g., `useWindowSize`, `useLocalStorage`)

Hooks to interact with browser APIs more declaratively.

```javascript
// frontend/src/hooks/useWindowSize.js (Conceptual)
import { useState, useEffect } from 'react';

export const useWindowSize = () => {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
};
```

## 5. Guidelines for Creating Custom Hooks

*   **Single Responsibility**: A custom hook should ideally do one thing well.
*   **Clear Interface**: Expose a clear and minimal API (what it returns).
*   **Follow Rules of Hooks**: Only call other Hooks at the top level of your custom hook. Don't call Hooks inside loops, conditions, or nested functions.
*   **Testability**: Write unit tests for your custom hooks, especially those with complex logic.
*   **Documentation**: Document what the hook does, its parameters, and what it returns, especially if it's intended for wide reuse.

---
*Review the `frontend/src/hooks/` directory to identify and document all significant custom hooks used in the LCFS project. Add specific examples and usage guidelines for each.* 