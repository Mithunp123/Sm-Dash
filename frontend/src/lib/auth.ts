import { api } from './api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'office_bearer' | 'student';
  is_interviewer?: boolean;
  mustChangePassword?: boolean;
  // Optional profile photo URL used for avatars/header
  photo_url?: string | null;
}

// Event emitter for auth state changes
const authChangeListeners: Set<() => void> = new Set();

export const auth = {
  getUser(): User | null {
    // Use sessionStorage so login lasts only for the current browser tab/session
    const userStr = sessionStorage.getItem('auth_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser(user: User) {
    sessionStorage.setItem('auth_user', JSON.stringify(user));
    // Notify all listeners of the change
    authChangeListeners.forEach(listener => listener());
    window.dispatchEvent(new Event('authChanged'));
  },

  // Subscribe to auth changes
  onAuthChange(callback: () => void) {
    authChangeListeners.add(callback);
    return () => authChangeListeners.delete(callback);
  },

  getToken(): string | null {
    return sessionStorage.getItem('auth_token');
  },

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  },

  async login(email: string, password: string) {
    const response = await api.login(email, password);
    if (response.success && response.user) {
      this.setUser(response.user);
      return response;
    }
    throw new Error(response.message || 'Login failed');
  },

  logout() {
    api.logout();
    sessionStorage.removeItem('auth_user');

    try {
      // Notify any listeners that auth changed
      window.dispatchEvent(new Event('authChanged'));
      // Ensure the app lands on a fresh login page after logout
      const loginUrl = `${window.location.origin}/login`;
      // Use replace to avoid adding a history entry for the protected page
      window.location.replace(loginUrl);
    } catch (err) {
      // If running in a non-browser environment or any error occurs, ignore
      console.warn('auth.logout: unable to navigate to login', err);
    }
  },

  getRole(): User['role'] | null {
    const user = this.getUser();
    return user?.role || null;
  },

  hasRole(...roles: User['role'][]): boolean {
    const userRole = this.getRole();
    return userRole ? roles.includes(userRole) : false;
  }
};

