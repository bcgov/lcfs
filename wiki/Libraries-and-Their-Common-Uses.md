# Libraries and Their Common Uses

This page provides guidelines and common usage examples for key libraries in the LCFS project. It is adapted from the original "08. Libraries and their common uses" wiki page and updated for current versions and practices.

## Frontend Libraries

### 1. Zustand (Client-Side State Management)

*   **Official Docs**: [Zustand GitHub](https://github.com/pmndrs/zustand)
*   **Purpose**: Used for global or shared client-side state that doesn't fit neatly into component state or server state managed by React Query.

#### Creating a Store

Stores are typically located in the `frontend/src/stores/` directory. You can create multiple stores for different domains of state.

```javascript
// frontend/src/stores/useUserStore.js
import { create } from 'zustand';

export const useUserStore = create((set) => ({
  currentUser: null, // Initial state for the user
  isLoading: false,
  error: null,

  // Action to set the current user
  setUser: (user) => set({ currentUser: user, isLoading: false, error: null }),

  // Example action for loading state
  setLoading: () => set({ isLoading: true }),
  setError: (errorMessage) => set({ error: errorMessage, isLoading: false }),
  clearUser: () => set({ currentUser: null, isLoading: false, error: null }),
}));
```

#### Using a Store in Components

```javascript
// Example React Component
import React from 'react';
import { useUserStore } from '@/stores/useUserStore'; // Assuming '@' alias for src/

export const UserProfileDisplay = () => {
  // Select specific state slices
  const currentUser = useUserStore((state) => state.currentUser);
  const isLoading = useUserStore((state) => state.isLoading);

  // Alternatively, select multiple state slices and actions
  // const { currentUser, setUser, isLoading } = useUserStore(
  //   (state) => ({ 
  //     currentUser: state.currentUser,
  //     setUser: state.setUser, 
  //     isLoading: state.isLoading 
  //   }),
  //   // Optional: shallow equality check for objects to prevent unnecessary re-renders
  //   // (state, newState) => JSON.stringify(state) === JSON.stringify(newState) 
  //   // or import { shallow } from 'zustand/shallow' and use shallow
  // );

  if (isLoading) {
    return <p>Loading user profile...</p>;
  }

  if (!currentUser) {
    return <p>No user logged in.</p>;
  }

  return (
    <div>
      <h1>{currentUser.firstName} {currentUser.lastName}</h1>
      {/* Display other user details */}
    </div>
  );
};
```

### 2. React Query (`@tanstack/react-query`) (Server State Management)

*   **Official Docs**: [TanStack Query](https://tanstack.com/query/latest)
*   **Purpose**: Manages server state: fetching, caching, synchronizing, and updating data from the backend API.

#### Queries (`useQuery` for GET requests)

It's best practice to encapsulate `useQuery` logic within custom hooks, typically in `frontend/src/hooks/`.

```javascript
// frontend/src/hooks/useUserData.js (Example)
import { useQuery } from '@tanstack/react-query';
import { useApiService } from '@/services/useApiService'; // Your custom API service hook

const USER_QUERY_KEY = 'currentUser';

export const useFetchCurrentUser = (options) => {
  const { client } = useApiService(); // Assumes useApiService provides an axios instance

  return useQuery({
    // queryKey should be unique and descriptive. Can include parameters.
    queryKey: [USER_QUERY_KEY],
    queryFn: async () => {
      const response = await client.get('/api/users/me'); // Example endpoint
      return response.data;
    },
    // React Query options (e.g., staleTime, cacheTime, enabled, retry, onSuccess, onError)
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options, // Allow overriding options
  });
};
```

**Using the custom query hook:**

```javascript
// Example React Component
import React from 'react';
import { useFetchCurrentUser } from '@/hooks/useUserData';

export const UserWelcome = () => {
  const { data: currentUser, isLoading, isError, error } = useFetchCurrentUser();

  if (isLoading) return <p>Loading...</p>;
  if (isError) return <p>Error fetching user: {error.message}</p>;

  return <h1>Welcome, {currentUser?.firstName}!</h1>;
};
```

#### Mutations (`useMutation` for POST, PUT, DELETE requests)

Similarly, encapsulate `useMutation` logic in custom hooks.

```javascript
// frontend/src/hooks/useUserData.js (Continued)
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useUpdateUserProfile = (options) => {
  const { client } = useApiService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData) => {
      const response = await client.put('/api/users/profile', userData); // Example endpoint
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      // Invalidate and refetch the current user query to get fresh data
      queryClient.invalidateQueries({ queryKey: [USER_QUERY_KEY] });
      // Optionally, directly update the cache if the response contains the full updated user
      // queryClient.setQueryData([USER_QUERY_KEY], data);
      console.log('Profile updated successfully!');
    },
    onError: (error, variables, context) => {
      console.error('Error updating profile:', error);
    },
    ...options,
  });
};
```

**Using the custom mutation hook:**

```javascript
// Example React Component
import React from 'react';
import { useUpdateUserProfile } from '@/hooks/useUserData';

export const ProfileEditForm = ({ initialData }) => {
  const { mutate: updateUser, isLoading: isUpdating } = useUpdateUserProfile();

  const handleSubmit = (formData) => {
    updateUser(formData);
  };

  // ... (form implementation using e.g., React Hook Form) ...

  return (
    <form onSubmit={/* Call handleSubmit with form data */}>
      {/* Form fields */}
      <button type="submit" disabled={isUpdating}>
        {isUpdating ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
};
```

#### Cache Invalidation

Invalidate queries to refetch data when you know it's stale (e.g., after a mutation).

```javascript
import { useQueryClient } from '@tanstack/react-query';

function MyComponent() {
  const queryClient = useQueryClient();

  const handleSomeAction = () => {
    // After some action that changes user data on the server...
    queryClient.invalidateQueries({ queryKey: [USER_QUERY_KEY] });
    // Can also invalidate multiple queries: queryClient.invalidateQueries({ queryKey: ['users'] });
  };
  // ...
}
```

### 3. React Hook Form
*   **Official Docs**: [React Hook Form](https://react-hook-form.com/)
*   **Purpose**: Efficiently manage form state, validation, and submission in React.
*   *(Placeholder for common usage patterns and integration with UI libraries like MUI. Refer to official docs for now.)*

### 4. AG Grid
*   **Official Docs**: [AG Grid Documentation](https://www.ag-grid.com/react-data-grid/)
*   **Purpose**: Powerful data grid/table component for displaying and manipulating large datasets.
*   *(Placeholder for common setup, column definitions, and feature usage. Refer to official docs for now.)*

### 5. Material-UI (MUI)
*   **Official Docs**: [MUI Documentation](https://mui.com/)
*   **Purpose**: Provides a comprehensive suite of React components following Material Design principles.
*   *(Placeholder for theming, component usage examples, and styling best practices. Refer to official docs for now.)*

### 6. Vite
*   **Official Docs**: [Vite Documentation](https://vitejs.dev/)
*   **Purpose**: Frontend build tool providing fast development server and optimized production builds.
*   Key configuration in `frontend/vite.config.js`. Handles HMR, path aliases (sync with `jsconfig.json`), and build optimizations.

## Backend Libraries

### 1. FastAPI
*   **Official Docs**: [FastAPI Documentation](https://fastapi.tiangolo.com/)
*   **Purpose**: Modern, high-performance Python web framework for building APIs.
*   *(Placeholder for common patterns: routers, dependency injection, Pydantic model usage, background tasks. Refer to official docs.)*

### 2. SQLAlchemy
*   **Official Docs**: [SQLAlchemy Documentation](https://www.sqlalchemy.org/)
*   **Purpose**: SQL toolkit and Object-Relational Mapper (ORM) for Python.
*   *(Placeholder for model definitions, session management, common query patterns, async usage with `asyncpg`. Refer to official docs.)*

### 3. Alembic
*   **Official Docs**: [Alembic Documentation](https://alembic.sqlalchemy.org/)
*   **Purpose**: Database migration tool for SQLAlchemy.
*   Managed via `backend/migrate.sh` script. See [Database Schema Overview](Database-Schema-Overview.md).

### 4. Pydantic
*   **Official Docs**: [Pydantic Documentation](https://docs.pydantic.dev/)
*   **Purpose**: Data validation and settings management using Python type annotations.
*   Heavily used in FastAPI for request/response models and in `backend/lcfs/settings.py` for application configuration.

---
*This page provides a starting point. For detailed API and advanced usage, always refer to the official documentation for each library.* 