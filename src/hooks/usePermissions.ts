import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';

interface Permissions {
  can_manage_users: boolean;
  can_manage_student_db: boolean;
  can_manage_profile_fields: boolean;
  can_manage_meetings: boolean;
  can_manage_events: boolean;
  can_manage_attendance: boolean;
  can_manage_bills: boolean;
  can_manage_projects: boolean;
  can_manage_resources: boolean;
  can_manage_teams: boolean;
  can_manage_volunteers: boolean;
  can_manage_messages: boolean;
  can_manage_students: boolean;
  can_manage_alumni: boolean;
  can_manage_feedback_questions: boolean;
  can_manage_feedback_reports: boolean;
  can_manage_permissions_module: boolean;
  can_manage_settings: boolean;
  can_view_analytics: boolean;
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<Permissions>({
    can_manage_users: false,
    can_manage_student_db: false,
    can_manage_profile_fields: false,
    can_manage_meetings: false,
    can_manage_events: false,
    can_manage_attendance: false,
    can_manage_bills: false,
    can_manage_projects: false,
    can_manage_resources: false,
    can_manage_teams: false,
    can_manage_volunteers: false,
    can_manage_messages: false,
    can_manage_students: false,
    can_manage_alumni: false,
    can_manage_feedback_questions: false,
    can_manage_feedback_reports: false,
    can_manage_permissions_module: false,
    can_manage_settings: false,
    can_view_analytics: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      const user = auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      // Admin has all permissions
      if (user.role === 'admin') {
        setPermissions({
          can_manage_users: true,
          can_manage_student_db: true,
          can_manage_profile_fields: true,
          can_manage_meetings: true,
          can_manage_events: true,
          can_manage_attendance: true,
          can_manage_bills: true,
          can_manage_projects: true,
          can_manage_resources: true,
          can_manage_teams: true,
          can_manage_volunteers: true,
          can_manage_messages: true,
          can_manage_students: true,
          can_manage_alumni: true,
          can_manage_feedback_questions: true,
          can_manage_feedback_reports: true,
          can_manage_permissions_module: true,
          can_manage_settings: true,
          can_view_analytics: true
        });
        setLoading(false);
        return;
      }

      // For non-admin users, try to fetch persisted permissions from backend
      try {
        const res = await api.getPermissions(user.id);
        if (res && res.success && res.permissions) {
          // Prefer explicit edit flags if present; fall back to legacy single-flag
          const p = res.permissions;
          const resolve = (key: string, variant: 'view' | 'edit') => {
            const field = `${key}_${variant}`;
            if (Object.prototype.hasOwnProperty.call(p, field)) {
              return p[field] === 1 || p[field] === true;
            }
            // legacy fallback
            return p[key] === 1 || p[key] === true;
          };
          setPermissions({
            can_manage_users: resolve('can_manage_users', 'view'),
            can_manage_student_db: resolve('can_manage_student_db', 'view'),
            can_manage_profile_fields: resolve('can_manage_profile_fields', 'view'),
            can_manage_meetings: resolve('can_manage_meetings', 'view'),
            can_manage_events: resolve('can_manage_events', 'view'),
            can_manage_attendance: resolve('can_manage_attendance', 'view'),
            can_manage_bills: resolve('can_manage_bills', 'view'),
            can_manage_projects: resolve('can_manage_projects', 'view'),
            can_manage_resources: resolve('can_manage_resources', 'view'),
            can_manage_teams: resolve('can_manage_teams', 'view'),
            can_manage_volunteers: resolve('can_manage_volunteers', 'view'),
            can_manage_messages: resolve('can_manage_messages', 'view'),
            can_manage_students: resolve('can_manage_students', 'view'),
            can_manage_alumni: resolve('can_manage_alumni', 'view'),
            can_manage_feedback_questions: resolve('can_manage_feedback_questions', 'view'),
            can_manage_feedback_reports: resolve('can_manage_feedback_reports', 'view'),
            can_manage_permissions_module: resolve('can_manage_permissions_module', 'view'),
            can_manage_settings: resolve('can_manage_settings', 'view'),
            can_view_analytics: resolve('can_view_analytics', 'view')
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to load persisted permissions, falling back to defaults', err);
      }

      // If no permissions found for office_bearer, they have no access (don't give default access)
      // This ensures permissions must be explicitly granted by admin
      if (user.role === 'office_bearer') {
        // Keep all permissions as false if none were found
        setPermissions({
          can_manage_users: false,
          can_manage_student_db: false,
          can_manage_profile_fields: false,
          can_manage_meetings: false,
          can_manage_events: false,
          can_manage_attendance: false,
          can_manage_bills: false,
          can_manage_projects: false,
          can_manage_resources: false,
          can_manage_teams: false,
          can_manage_volunteers: false,
          can_manage_messages: false,
          can_manage_students: false,
          can_manage_alumni: false,
          can_manage_feedback_questions: false,
          can_manage_feedback_reports: false,
          can_manage_permissions_module: false,
          can_manage_settings: false,
          can_view_analytics: false
        });
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    loadPermissions();
    // Re-load permissions when window gains focus (helps pickup changes made by admin from another tab/session)
    const onFocus = () => {
      loadPermissions();
    };

    // Also listen to storage events (useful if another tab updates auth or permissions)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'auth_user' || e.key === 'permissions_updated') {
        loadPermissions();
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return { permissions, loading };
};

