import { api } from './api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'office_bearer' | 'student';
  mustChangePassword?: boolean;
  // Optional profile photo URL used for avatars/header
  photo_url?: string | null;
}

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

