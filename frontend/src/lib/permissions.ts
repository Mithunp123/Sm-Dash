import { auth } from './auth';

// Returns true when the current authenticated user should be treated as read-only admin
export const isAdminReadOnly = () => {
  try {
    return auth.isAuthenticated() && auth.hasRole('admin');
  } catch (e) {
    return false;
  }
};

export default isAdminReadOnly;
