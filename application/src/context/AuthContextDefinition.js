import { createContext } from 'react';

// Create the context in a separate file to maintain identity during HMR
const AuthContext = createContext(null);

export default AuthContext;
