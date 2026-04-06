import { useEffect, useState } from 'react';
import { auth } from '@/lib/auth';
import logger from '@/utils/logger';

/**
 * Role hierarchy for reference
 * Higher number = more permissions
 */
const ROLE_HIERARCHY = {
  'President': 10,
  'Vice President': 9,
  'Secretary': 7,
  'Joint Secretary': 5,
  'Treasurer': 4,
  'Joint Treasurer': 3,
  'student': 1
};

/**
 * Local permission cache (frontend only - for UI rendering)
 * Backend always validates permissions!
 */
const ROLE_PERMISSIONS = {
  'President': {
    view: ['all'],
    create: ['all'],
    edit: ['all'],
    delete: ['all']
  },
  'Vice President': {
    view: ['all'],
    create: ['all'],
    edit: ['all'],
    delete: ['all']
  },
  'Secretary': {
    view: ['people', 'projects', 'meetings', 'teams', 'events', 'announcements', 'reports'],
    create: ['meetings', 'projects'],
    edit: ['meetings', 'projects'],
    delete: []
  },
  'Joint Secretary': {
    view: ['people', 'meetings', 'events', 'announcements', 'teams'],
    create: [],
    edit: [],
    delete: []
  },
  'Treasurer': {
    view: ['finance', 'reports', 'events', 'announcements'],
    create: ['finance'],
    edit: ['finance'],
    delete: []
  },
  'Joint Treasurer': {
    view: ['finance', 'reports', 'announcements'],
    create: [],
    edit: [],
    delete: []
  },
  'student': {
    view: ['events', 'teams', 'announcements', 'attendance', 'profile', 'messages', 'feedback'],
    create: ['messages', 'feedback'],
    edit: ['profile'],
    delete: []
  }
};

/**
 * useRole Hook
 * Manages user role information and permission checks
 *
 * @returns {Object} Role utilities and permission checkers
 */
export const useRole = () => {
  const [role, setRole] = useState<string>('student');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch effective role from backend
   * Called on mount and when location changes
   */
  const fetchEffectiveRole = async () => {
    try {
      setLoading(true);
      const user = auth.getUser();

      if (!user?.id) {
        setRole('student');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/user/${user.id}/role`,
        {
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.effective_role) {
        setRole(data.effective_role);
        logger.debug(`[useRole] Fetched role: ${data.effective_role}`);
      } else {
        setRole('student');
      }
    } catch (error) {
      logger.error('[useRole] Failed to fetch role:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch role');
      setRole('student'); // Safe default
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch role on component mount
   */
  useEffect(() => {
    fetchEffectiveRole();

    // Listen for role changes (e.g., from profileUpdated event)
    const handleRoleChange = () => {
      fetchEffectiveRole();
    };

    window.addEventListener('roleUpdated', handleRoleChange);
    return () => window.removeEventListener('roleUpdated', handleRoleChange);
  }, []);

  /**
   * Check if user has permission for a specific action on a feature
   * Uses local cache for UI rendering - backend validates actual access
   *
   * @param {string} feature - Feature name (e.g., 'finance', 'people')
   * @param {string} action - Action type ('view', 'create', 'edit', 'delete')
   * @returns {boolean} True if user has permission
   */
  const hasPermission = (feature: string, action: string = 'view'): boolean => {
    if (!feature) return false;

    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['student'];
    const allowed = permissions[action] || [];

    return allowed.includes('all') || allowed.includes(feature);
  };

  /**
   * Check if user can view a feature
   *
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  const canViewFeature = (feature: string): boolean => {
    return hasPermission(feature, 'view');
  };

  /**
   * Check if user can create items in a feature
   *
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  const canCreateFeature = (feature: string): boolean => {
    return hasPermission(feature, 'create');
  };

  /**
   * Check if user can edit items in a feature
   *
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  const canEditFeature = (feature: string): boolean => {
    return hasPermission(feature, 'edit');
  };

  /**
   * Check if user can delete items in a feature
   *
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  const canDeleteFeature = (feature: string): boolean => {
    return hasPermission(feature, 'delete');
  };

  /**
   * Get numeric hierarchy level of current role
   * Higher = more permissions
   *
   * @returns {number}
   */
  const getHierarchyLevel = (): number => {
    return ROLE_HIERARCHY[role] || 1;
  };

  /**
   * Check if current role is President
   *
   * @returns {boolean}
   */
  const isPresident = (): boolean => role === 'President';

  /**
   * Check if current role is Vice President
   *
   * @returns {boolean}
   */
  const isVicePresident = (): boolean => role === 'Vice President';

  /**
   * Check if current role is super admin (President or Vice President)
   *
   * @returns {boolean}
   */
  const isSuperAdmin = (): boolean => isPresident() || isVicePresident();

  /**
   * Check if current role is secretary (Secretary or Joint Secretary)
   *
   * @returns {boolean}
   */
  const isSecretary = (): boolean => 
    role === 'Secretary' || role === 'Joint Secretary';

  /**
   * Check if current role is treasurer (Treasurer or Joint Treasurer)
   *
   * @returns {boolean}
   */
  const isTreasurer = (): boolean => 
    role === 'Treasurer' || role === 'Joint Treasurer';

  /**
   * Check if current role is student (default user)
   *
   * @returns {boolean}
   */
  const isStudent = (): boolean => role === 'student';

  /**
   * Get all current permissions for the user's role
   * 
   * @returns {Object}
   */
  const getAllPermissions = (): object => {
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['student'];
  };

  /**
   * Manually refresh role from backend
   * Useful after role changes
   */
  const refreshRole = async (): Promise<void> => {
    await fetchEffectiveRole();
  };

  return {
    // Current role and loading state
    role,
    loading,
    error,

    // Permission checkers
    hasPermission,
    canViewFeature,
    canCreateFeature,
    canEditFeature,
    canDeleteFeature,
    getAllPermissions,

    // Role checks
    getHierarchyLevel,
    isPresident,
    isVicePresident,
    isSuperAdmin,
    isSecretary,
    isTreasurer,
    isStudent,

    // Utility
    refreshRole
  };
};

export default useRole;
