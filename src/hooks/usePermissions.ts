import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';

interface Permissions {
  can_manage_users: boolean;
  can_manage_users_view: boolean;
  can_manage_users_edit: boolean;
  can_manage_student_db: boolean;
  can_manage_student_db_view: boolean;
  can_manage_student_db_edit: boolean;
  can_manage_profile_fields: boolean;
  can_manage_profile_fields_view: boolean;
  can_manage_profile_fields_edit: boolean;
  can_manage_meetings: boolean;
  can_manage_meetings_view: boolean;
  can_manage_meetings_edit: boolean;
  can_manage_events: boolean;
  can_manage_events_view: boolean;
  can_manage_events_edit: boolean;
  can_manage_attendance: boolean;
  can_manage_attendance_view: boolean;
  can_manage_attendance_edit: boolean;
  can_manage_bills: boolean;
  can_manage_bills_view: boolean;
  can_manage_bills_edit: boolean;
  can_manage_projects: boolean;
  can_manage_projects_view: boolean;
  can_manage_projects_edit: boolean;
  can_manage_resources: boolean;
  can_manage_resources_view: boolean;
  can_manage_resources_edit: boolean;
  can_manage_teams: boolean;
  can_manage_teams_view: boolean;
  can_manage_teams_edit: boolean;
  can_manage_volunteers: boolean;
  can_manage_volunteers_view: boolean;
  can_manage_volunteers_edit: boolean;
  can_manage_messages: boolean;
  can_manage_messages_view: boolean;
  can_manage_messages_edit: boolean;
  can_manage_students: boolean;
  can_manage_students_view: boolean;
  can_manage_students_edit: boolean;
  can_manage_alumni: boolean;
  can_manage_alumni_view: boolean;
  can_manage_alumni_edit: boolean;
  can_manage_feedback_questions: boolean;
  can_manage_feedback_questions_view: boolean;
  can_manage_feedback_questions_edit: boolean;
  can_manage_feedback_reports: boolean;
  can_manage_feedback_reports_view: boolean;
  can_manage_feedback_reports_edit: boolean;
  can_manage_permissions_module: boolean;
  can_manage_permissions_module_view: boolean;
  can_manage_permissions_module_edit: boolean;
  can_manage_settings: boolean;
  can_manage_settings_view: boolean;
  can_manage_settings_edit: boolean;
  can_view_analytics: boolean;
  can_view_reports: boolean;
  // Assignment-based access for students
  can_view_assigned_projects: boolean;
  can_view_assigned_attendance: boolean;
  can_view_assigned_bills: boolean;
  can_view_assigned_reports: boolean;
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<Permissions>({
    can_manage_users: false,
    can_manage_users_view: false,
    can_manage_users_edit: false,
    can_manage_student_db: false,
    can_manage_student_db_view: false,
    can_manage_student_db_edit: false,
    can_manage_profile_fields: false,
    can_manage_profile_fields_view: false,
    can_manage_profile_fields_edit: false,
    can_manage_meetings: false,
    can_manage_meetings_view: false,
    can_manage_meetings_edit: false,
    can_manage_events: false,
    can_manage_events_view: false,
    can_manage_events_edit: false,
    can_manage_attendance: false,
    can_manage_attendance_view: false,
    can_manage_attendance_edit: false,
    can_manage_bills: false,
    can_manage_bills_view: false,
    can_manage_bills_edit: false,
    can_manage_projects: false,
    can_manage_projects_view: false,
    can_manage_projects_edit: false,
    can_manage_resources: false,
    can_manage_resources_view: false,
    can_manage_resources_edit: false,
    can_manage_teams: false,
    can_manage_teams_view: false,
    can_manage_teams_edit: false,
    can_manage_volunteers: false,
    can_manage_volunteers_view: false,
    can_manage_volunteers_edit: false,
    can_manage_messages: false,
    can_manage_messages_view: false,
    can_manage_messages_edit: false,
    can_manage_students: false,
    can_manage_students_view: false,
    can_manage_students_edit: false,
    can_manage_alumni: false,
    can_manage_alumni_view: false,
    can_manage_alumni_edit: false,
    can_manage_feedback_questions: false,
    can_manage_feedback_questions_view: false,
    can_manage_feedback_questions_edit: false,
    can_manage_feedback_reports: false,
    can_manage_feedback_reports_view: false,
    can_manage_feedback_reports_edit: false,
    can_manage_permissions_module: false,
    can_manage_permissions_module_view: false,
    can_manage_permissions_module_edit: false,
    can_manage_settings: false,
    can_manage_settings_view: false,
    can_manage_settings_edit: false,
    can_view_analytics: false,
    can_view_reports: false,
    can_view_assigned_projects: false,
    can_view_assigned_attendance: false,
    can_view_assigned_bills: false,
    can_view_assigned_reports: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      const user = auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Permission system disabled - Admin and Office Bearers have all permissions
      if (user.role === 'admin' || user.role === 'office_bearer') {
        setPermissions({
          can_manage_users: true,
          can_manage_users_view: true,
          can_manage_users_edit: true,
          can_manage_student_db: true,
          can_manage_student_db_view: true,
          can_manage_student_db_edit: true,
          can_manage_profile_fields: true,
          can_manage_profile_fields_view: true,
          can_manage_profile_fields_edit: true,
          can_manage_meetings: true,
          can_manage_meetings_view: true,
          can_manage_meetings_edit: true,
          can_manage_events: true,
          can_manage_events_view: true,
          can_manage_events_edit: true,
          can_manage_attendance: true,
          can_manage_attendance_view: true,
          can_manage_attendance_edit: true,
          can_manage_bills: true,
          can_manage_bills_view: true,
          can_manage_bills_edit: true,
          can_manage_projects: true,
          can_manage_projects_view: true,
          can_manage_projects_edit: true,
          can_manage_resources: true,
          can_manage_resources_view: true,
          can_manage_resources_edit: true,
          can_manage_teams: true,
          can_manage_teams_view: true,
          can_manage_teams_edit: true,
          can_manage_volunteers: true,
          can_manage_volunteers_view: true,
          can_manage_volunteers_edit: true,
          can_manage_messages: true,
          can_manage_messages_view: true,
          can_manage_messages_edit: true,
          can_manage_students: true,
          can_manage_students_view: true,
          can_manage_students_edit: true,
          can_manage_alumni: true,
          can_manage_alumni_view: true,
          can_manage_alumni_edit: true,
          can_manage_feedback_questions: true,
          can_manage_feedback_questions_view: true,
          can_manage_feedback_questions_edit: true,
          can_manage_feedback_reports: true,
          can_manage_feedback_reports_view: true,
          can_manage_feedback_reports_edit: true,
          can_manage_permissions_module: true,
          can_manage_permissions_module_view: true,
          can_manage_permissions_module_edit: true,
          can_manage_settings: true,
          can_manage_settings_view: true,
          can_manage_settings_edit: true,
          can_view_analytics: true,
          can_view_reports: true,
          can_view_assigned_projects: true,
          can_view_assigned_attendance: true,
          can_view_assigned_bills: true,
          can_view_assigned_reports: true
        });
      } else if (user.role === 'student') {
        // Students: permissions system removed as requested
        setPermissions({
          can_manage_users: false,
          can_manage_users_view: false,
          can_manage_users_edit: false,
          can_manage_student_db: false,
          can_manage_student_db_view: false,
          can_manage_student_db_edit: false,
          can_manage_profile_fields: false,
          can_manage_profile_fields_view: false,
          can_manage_profile_fields_edit: false,
          can_manage_meetings: false,
          can_manage_meetings_view: false,
          can_manage_meetings_edit: false,
          can_manage_events: false,
          can_manage_events_view: false,
          can_manage_events_edit: false,
          can_manage_attendance: false,
          can_manage_attendance_view: false,
          can_manage_attendance_edit: false,
          can_manage_bills: false,
          can_manage_bills_view: false,
          can_manage_bills_edit: false,
          can_manage_projects: false,
          can_manage_projects_view: false,
          can_manage_projects_edit: false,
          can_manage_resources: false,
          can_manage_resources_view: false,
          can_manage_resources_edit: false,
          can_manage_teams: false,
          can_manage_teams_view: false,
          can_manage_teams_edit: false,
          can_manage_volunteers: false,
          can_manage_volunteers_view: false,
          can_manage_volunteers_edit: false,
          can_manage_messages: false,
          can_manage_messages_view: false,
          can_manage_messages_edit: false,
          can_manage_students: false,
          can_manage_students_view: false,
          can_manage_students_edit: false,
          can_manage_alumni: false,
          can_manage_alumni_view: false,
          can_manage_alumni_edit: false,
          can_manage_feedback_questions: false,
          can_manage_feedback_questions_view: false,
          can_manage_feedback_questions_edit: false,
          can_manage_feedback_reports: false,
          can_manage_feedback_reports_view: false,
          can_manage_feedback_reports_edit: false,
          can_manage_permissions_module: false,
          can_manage_permissions_module_view: false,
          can_manage_permissions_module_edit: false,
          can_manage_settings: false,
          can_manage_settings_view: false,
          can_manage_settings_edit: false,
          can_view_analytics: false,
          can_view_reports: false,
          can_view_assigned_projects: false,
          can_view_assigned_attendance: false,
          can_view_assigned_bills: false,
          can_view_assigned_reports: false
        });
      } else {
        // All other roles get no permissions (alumni, etc.)
        setPermissions({
          can_manage_users: false,
          can_manage_users_view: false,
          can_manage_users_edit: false,
          can_manage_student_db: false,
          can_manage_student_db_view: false,
          can_manage_student_db_edit: false,
          can_manage_profile_fields: false,
          can_manage_profile_fields_view: false,
          can_manage_profile_fields_edit: false,
          can_manage_meetings: false,
          can_manage_meetings_view: false,
          can_manage_meetings_edit: false,
          can_manage_events: false,
          can_manage_events_view: false,
          can_manage_events_edit: false,
          can_manage_attendance: false,
          can_manage_attendance_view: false,
          can_manage_attendance_edit: false,
          can_manage_bills: false,
          can_manage_bills_view: false,
          can_manage_bills_edit: false,
          can_manage_projects: false,
          can_manage_projects_view: false,
          can_manage_projects_edit: false,
          can_manage_resources: false,
          can_manage_resources_view: false,
          can_manage_resources_edit: false,
          can_manage_teams: false,
          can_manage_teams_view: false,
          can_manage_teams_edit: false,
          can_manage_volunteers: false,
          can_manage_volunteers_view: false,
          can_manage_volunteers_edit: false,
          can_manage_messages: false,
          can_manage_messages_view: false,
          can_manage_messages_edit: false,
          can_manage_students: false,
          can_manage_students_view: false,
          can_manage_students_edit: false,
          can_manage_alumni: false,
          can_manage_alumni_view: false,
          can_manage_alumni_edit: false,
          can_manage_feedback_questions: false,
          can_manage_feedback_questions_view: false,
          can_manage_feedback_questions_edit: false,
          can_manage_feedback_reports: false,
          can_manage_feedback_reports_view: false,
          can_manage_feedback_reports_edit: false,
          can_manage_permissions_module: false,
          can_manage_permissions_module_view: false,
          can_manage_permissions_module_edit: false,
          can_manage_settings: false,
          can_manage_settings_view: false,
          can_manage_settings_edit: false,
          can_view_analytics: false,
          can_view_reports: false,
          can_view_assigned_projects: false,
          can_view_assigned_attendance: false,
          can_view_assigned_bills: false,
          can_view_assigned_reports: false
        });
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

