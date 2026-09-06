import { createContext } from 'react';

// AuthContext is defined here separately from AuthProvider to satisfy
// react-refresh/only-export-components: files that export both components
// and non-components (like contexts) break Fast Refresh.
export const AuthContext = createContext();
