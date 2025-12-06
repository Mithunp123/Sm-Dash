import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

const get = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const run = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Get permissions for a user
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDatabase();
    
    // Users can only view their own permissions unless admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const permission = await get(db, 'SELECT * FROM permissions WHERE user_id = ?', [userId]);
    
    if (!permission) {
      // Return default permissions (all false)
      return res.json({
        success: true,
        permissions: {
          can_manage_users: false,
          can_manage_student_db: false,
          can_manage_profile_fields: false,
          can_manage_meetings: false,
          can_manage_events: false,
          can_manage_attendance: false,
          can_manage_bills: false,
          can_manage_projects: false,
          can_manage_resources: false,
          can_manage_volunteers: false,
          can_manage_messages: false,
          can_manage_students: false,
          can_manage_alumni: false,
          can_manage_feedback_questions: false,
          can_manage_feedback_reports: false,
          can_manage_permissions_module: false,
          can_manage_settings: false,
          can_view_analytics: false,
          can_manage_time_requests: false,
          can_approve_time_extensions: false,
          can_reject_time_extensions: false
        }
      });
    }

    res.json({
      success: true,
      permissions: {
        can_manage_users: permission.can_manage_users === 1,
        can_manage_users_view: (permission.can_manage_users_view === 1) || (permission.can_manage_users === 1),
        can_manage_users_edit: (permission.can_manage_users_edit === 1) || (permission.can_manage_users === 1),
        can_manage_student_db: permission.can_manage_student_db === 1,
        can_manage_student_db_view: (permission.can_manage_student_db_view === 1) || (permission.can_manage_student_db === 1),
        can_manage_student_db_edit: (permission.can_manage_student_db_edit === 1) || (permission.can_manage_student_db === 1),
        can_manage_profile_fields: permission.can_manage_profile_fields === 1,
        can_manage_profile_fields_view: (permission.can_manage_profile_fields_view === 1) || (permission.can_manage_profile_fields === 1),
        can_manage_profile_fields_edit: (permission.can_manage_profile_fields_edit === 1) || (permission.can_manage_profile_fields === 1),
        can_manage_meetings: permission.can_manage_meetings === 1,
        can_manage_meetings_view: (permission.can_manage_meetings_view === 1) || (permission.can_manage_meetings === 1),
        can_manage_meetings_edit: (permission.can_manage_meetings_edit === 1) || (permission.can_manage_meetings === 1),
        can_manage_events: permission.can_manage_events === 1,
        can_manage_events_view: (permission.can_manage_events_view === 1) || (permission.can_manage_events === 1),
        can_manage_events_edit: (permission.can_manage_events_edit === 1) || (permission.can_manage_events === 1),
        can_manage_attendance: permission.can_manage_attendance === 1,
        can_manage_attendance_view: (permission.can_manage_attendance_view === 1) || (permission.can_manage_attendance === 1),
        can_manage_attendance_edit: (permission.can_manage_attendance_edit === 1) || (permission.can_manage_attendance === 1),
        can_manage_bills: permission.can_manage_bills === 1,
        can_manage_bills_view: (permission.can_manage_bills_view === 1) || (permission.can_manage_bills === 1),
        can_manage_bills_edit: (permission.can_manage_bills_edit === 1) || (permission.can_manage_bills === 1),
        can_manage_projects: permission.can_manage_projects === 1,
        can_manage_projects_view: (permission.can_manage_projects_view === 1) || (permission.can_manage_projects === 1),
        can_manage_projects_edit: (permission.can_manage_projects_edit === 1) || (permission.can_manage_projects === 1),
        can_manage_resources: permission.can_manage_resources === 1,
        can_manage_resources_view: (permission.can_manage_resources_view === 1) || (permission.can_manage_resources === 1),
        can_manage_resources_edit: (permission.can_manage_resources_edit === 1) || (permission.can_manage_resources === 1),
        can_manage_volunteers: permission.can_manage_volunteers === 1,
        can_manage_volunteers_view: (permission.can_manage_volunteers_view === 1) || (permission.can_manage_volunteers === 1),
        can_manage_volunteers_edit: (permission.can_manage_volunteers_edit === 1) || (permission.can_manage_volunteers === 1),
        can_manage_messages: permission.can_manage_messages === 1,
        can_manage_messages_view: (permission.can_manage_messages_view === 1) || (permission.can_manage_messages === 1),
        can_manage_messages_edit: (permission.can_manage_messages_edit === 1) || (permission.can_manage_messages === 1),
        can_manage_students: permission.can_manage_students === 1,
        can_manage_students_view: (permission.can_manage_students_view === 1) || (permission.can_manage_students === 1),
        can_manage_students_edit: (permission.can_manage_students_edit === 1) || (permission.can_manage_students === 1),
        can_manage_alumni: permission.can_manage_alumni === 1,
        can_manage_alumni_view: (permission.can_manage_alumni_view === 1) || (permission.can_manage_alumni === 1),
        can_manage_alumni_edit: (permission.can_manage_alumni_edit === 1) || (permission.can_manage_alumni === 1),
        can_manage_feedback_questions: permission.can_manage_feedback_questions === 1,
        can_manage_feedback_questions_view: (permission.can_manage_feedback_questions_view === 1) || (permission.can_manage_feedback_questions === 1),
        can_manage_feedback_questions_edit: (permission.can_manage_feedback_questions_edit === 1) || (permission.can_manage_feedback_questions === 1),
        can_manage_feedback_reports: permission.can_manage_feedback_reports === 1,
        can_manage_feedback_reports_view: (permission.can_manage_feedback_reports_view === 1) || (permission.can_manage_feedback_reports === 1),
        can_manage_feedback_reports_edit: (permission.can_manage_feedback_reports_edit === 1) || (permission.can_manage_feedback_reports === 1),
        can_manage_permissions_module: permission.can_manage_permissions_module === 1,
        can_manage_permissions_module_view: (permission.can_manage_permissions_module_view === 1) || (permission.can_manage_permissions_module === 1),
        can_manage_permissions_module_edit: (permission.can_manage_permissions_module_edit === 1) || (permission.can_manage_permissions_module === 1),
        can_manage_settings: permission.can_manage_settings === 1,
        can_manage_settings_view: (permission.can_manage_settings_view === 1) || (permission.can_manage_settings === 1),
        can_manage_settings_edit: (permission.can_manage_settings_edit === 1) || (permission.can_manage_settings === 1),
        can_view_analytics: permission.can_view_analytics === 1,
        can_view_analytics_view: (permission.can_view_analytics_view === 1) || (permission.can_view_analytics === 1),
        can_view_analytics_edit: (permission.can_view_analytics_edit === 1) || (permission.can_view_analytics === 1),
        can_manage_time_requests: permission.can_manage_time_requests === 1,
        can_approve_time_extensions: permission.can_approve_time_extensions === 1,
        can_reject_time_extensions: permission.can_reject_time_extensions === 1
      }
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all permissions (Admins or permission managers - view only)
router.get('/', authenticateToken, requirePermission('can_manage_permissions_module'), async (req, res) => {
  try {
    const db = getDatabase();
    const permissions = await all(db, `
      SELECT p.*, u.name, u.email, u.role
      FROM permissions p
      JOIN users u ON p.user_id = u.id
      WHERE u.role IN ('office_bearer')
      ORDER BY u.name
    `);
    
    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Get all permissions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Lightweight user list for permissions management (view-only)
router.get('/users', authenticateToken, requirePermission('can_manage_permissions_module'), async (req, res) => {
  try {
    const db = getDatabase();
    const users = await all(db, `
      SELECT id, name, email, role, created_at
      FROM users
      WHERE role IN ('office_bearer', 'student', 'alumni')
      ORDER BY name
    `);
    res.json({ success: true, users });
  } catch (error) {
    console.error('Get permission users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update permissions (Admin only)
router.put('/:userId', authenticateToken, requireRole('admin'), [
  body('can_manage_users').optional().isBoolean(),
  body('can_manage_student_db').optional().isBoolean(),
  body('can_manage_profile_fields').optional().isBoolean(),
  body('can_manage_meetings').optional().isBoolean(),
  body('can_manage_events').optional().isBoolean(),
  body('can_manage_attendance').optional().isBoolean(),
  body('can_manage_bills').optional().isBoolean(),
  body('can_manage_projects').optional().isBoolean(),
  body('can_manage_resources').optional().isBoolean(),
  body('can_manage_volunteers').optional().isBoolean(),
  body('can_manage_messages').optional().isBoolean(),
  body('can_manage_students').optional().isBoolean(),
  body('can_manage_alumni').optional().isBoolean(),
  body('can_manage_feedback_questions').optional().isBoolean(),
  body('can_manage_feedback_reports').optional().isBoolean(),
  body('can_manage_permissions_module').optional().isBoolean(),
  body('can_manage_settings').optional().isBoolean(),
  body('can_view_analytics').optional().isBoolean(),
  body('can_manage_time_requests').optional().isBoolean(),
  body('can_approve_time_extensions').optional().isBoolean(),
  body('can_reject_time_extensions').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId } = req.params;
    const body = req.body;
    
    // Helper function to get permission value, defaulting based on view/edit if base is not provided
    const getPermissionValue = (baseKey, viewKey, editKey) => {
      const base = body[baseKey];
      const view = body[viewKey];
      const edit = body[editKey];
      // If base is explicitly provided, use it; otherwise derive from view/edit
      if (base !== undefined) {
        return base ? 1 : 0;
      }
      // If base not provided, set it to true if either view or edit is true
      return (view || edit) ? 1 : 0;
    };
    
    const {
      can_manage_users = getPermissionValue('can_manage_users', 'can_manage_users_view', 'can_manage_users_edit'),
      can_manage_student_db = getPermissionValue('can_manage_student_db', 'can_manage_student_db_view', 'can_manage_student_db_edit'),
      can_manage_profile_fields = getPermissionValue('can_manage_profile_fields', 'can_manage_profile_fields_view', 'can_manage_profile_fields_edit'),
      can_manage_meetings = getPermissionValue('can_manage_meetings', 'can_manage_meetings_view', 'can_manage_meetings_edit'),
      can_manage_events = getPermissionValue('can_manage_events', 'can_manage_events_view', 'can_manage_events_edit'),
      can_manage_attendance = getPermissionValue('can_manage_attendance', 'can_manage_attendance_view', 'can_manage_attendance_edit'),
      can_manage_bills = getPermissionValue('can_manage_bills', 'can_manage_bills_view', 'can_manage_bills_edit'),
      can_manage_projects = getPermissionValue('can_manage_projects', 'can_manage_projects_view', 'can_manage_projects_edit'),
      can_manage_resources = getPermissionValue('can_manage_resources', 'can_manage_resources_view', 'can_manage_resources_edit'),
      can_manage_volunteers = getPermissionValue('can_manage_volunteers', 'can_manage_volunteers_view', 'can_manage_volunteers_edit'),
      can_manage_messages = getPermissionValue('can_manage_messages', 'can_manage_messages_view', 'can_manage_messages_edit'),
      can_manage_students = getPermissionValue('can_manage_students', 'can_manage_students_view', 'can_manage_students_edit'),
      can_manage_alumni = getPermissionValue('can_manage_alumni', 'can_manage_alumni_view', 'can_manage_alumni_edit'),
      can_manage_feedback_questions = getPermissionValue('can_manage_feedback_questions', 'can_manage_feedback_questions_view', 'can_manage_feedback_questions_edit'),
      can_manage_feedback_reports = getPermissionValue('can_manage_feedback_reports', 'can_manage_feedback_reports_view', 'can_manage_feedback_reports_edit'),
      can_manage_permissions_module = getPermissionValue('can_manage_permissions_module', 'can_manage_permissions_module_view', 'can_manage_permissions_module_edit'),
      can_manage_settings = getPermissionValue('can_manage_settings', 'can_manage_settings_view', 'can_manage_settings_edit'),
      can_view_analytics = getPermissionValue('can_view_analytics', 'can_view_analytics_view', 'can_view_analytics_edit'),
      // view/edit variants (optional)
      can_manage_users_view = body.can_manage_users_view || false,
      can_manage_users_edit = body.can_manage_users_edit || false,
      can_manage_student_db_view = body.can_manage_student_db_view || false,
      can_manage_student_db_edit = body.can_manage_student_db_edit || false,
      can_manage_profile_fields_view = body.can_manage_profile_fields_view || false,
      can_manage_profile_fields_edit = body.can_manage_profile_fields_edit || false,
      can_manage_meetings_view = body.can_manage_meetings_view || false,
      can_manage_meetings_edit = body.can_manage_meetings_edit || false,
      can_manage_events_view = body.can_manage_events_view || false,
      can_manage_events_edit = body.can_manage_events_edit || false,
      can_manage_attendance_view = body.can_manage_attendance_view || false,
      can_manage_attendance_edit = body.can_manage_attendance_edit || false,
      can_manage_bills_view = body.can_manage_bills_view || false,
      can_manage_bills_edit = body.can_manage_bills_edit || false,
      can_manage_projects_view = body.can_manage_projects_view || false,
      can_manage_projects_edit = body.can_manage_projects_edit || false,
      can_manage_resources_view = body.can_manage_resources_view || false,
      can_manage_resources_edit = body.can_manage_resources_edit || false,
      can_manage_volunteers_view = body.can_manage_volunteers_view || false,
      can_manage_volunteers_edit = body.can_manage_volunteers_edit || false,
      can_manage_messages_view = body.can_manage_messages_view || false,
      can_manage_messages_edit = body.can_manage_messages_edit || false,
      can_manage_students_view = body.can_manage_students_view || false,
      can_manage_students_edit = body.can_manage_students_edit || false,
      can_manage_alumni_view = body.can_manage_alumni_view || false,
      can_manage_alumni_edit = body.can_manage_alumni_edit || false,
      can_manage_feedback_questions_view = body.can_manage_feedback_questions_view || false,
      can_manage_feedback_questions_edit = body.can_manage_feedback_questions_edit || false,
      can_manage_feedback_reports_view = body.can_manage_feedback_reports_view || false,
      can_manage_feedback_reports_edit = body.can_manage_feedback_reports_edit || false,
      can_manage_permissions_module_view = body.can_manage_permissions_module_view || false,
      can_manage_permissions_module_edit = body.can_manage_permissions_module_edit || false,
      can_manage_settings_view = body.can_manage_settings_view || false,
      can_manage_settings_edit = body.can_manage_settings_edit || false,
      can_view_analytics_view = body.can_view_analytics_view || false,
      can_view_analytics_edit = body.can_view_analytics_edit || false,
      can_manage_time_requests = body.can_manage_time_requests || false,
      can_approve_time_extensions = body.can_approve_time_extensions || false,
      can_reject_time_extensions = body.can_reject_time_extensions || false
    } = body;
    
    const db = getDatabase();

  // Check if user exists and is office_bearer
    const user = await get(db, 'SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'office_bearer') {
      return res.status(400).json({ success: false, message: 'Permissions can only be set for Office Bearers' });
    }

    // Check if permission record exists
    const existing = await get(db, 'SELECT id FROM permissions WHERE user_id = ?', [userId]);

    if (existing) {
      // Update existing permissions
      // Update existing permissions including view/edit columns
      await run(db, `
        UPDATE permissions SET
          can_manage_users = ?, can_manage_users_view = ?, can_manage_users_edit = ?,
          can_manage_student_db = ?, can_manage_student_db_view = ?, can_manage_student_db_edit = ?,
          can_manage_profile_fields = ?, can_manage_profile_fields_view = ?, can_manage_profile_fields_edit = ?,
          can_manage_meetings = ?, can_manage_meetings_view = ?, can_manage_meetings_edit = ?,
          can_manage_events = ?, can_manage_events_view = ?, can_manage_events_edit = ?,
          can_manage_attendance = ?, can_manage_attendance_view = ?, can_manage_attendance_edit = ?,
          can_manage_bills = ?, can_manage_bills_view = ?, can_manage_bills_edit = ?,
          can_manage_projects = ?, can_manage_projects_view = ?, can_manage_projects_edit = ?,
          can_manage_resources = ?, can_manage_resources_view = ?, can_manage_resources_edit = ?,
          can_manage_volunteers = ?, can_manage_volunteers_view = ?, can_manage_volunteers_edit = ?,
          can_manage_messages = ?, can_manage_messages_view = ?, can_manage_messages_edit = ?,
          can_manage_students = ?, can_manage_students_view = ?, can_manage_students_edit = ?,
          can_manage_alumni = ?, can_manage_alumni_view = ?, can_manage_alumni_edit = ?,
          can_manage_feedback_questions = ?, can_manage_feedback_questions_view = ?, can_manage_feedback_questions_edit = ?,
          can_manage_feedback_reports = ?, can_manage_feedback_reports_view = ?, can_manage_feedback_reports_edit = ?,
          can_manage_permissions_module = ?, can_manage_permissions_module_view = ?, can_manage_permissions_module_edit = ?,
          can_manage_settings = ?, can_manage_settings_view = ?, can_manage_settings_edit = ?,
          can_view_analytics = ?, can_view_analytics_view = ?, can_view_analytics_edit = ?,
          can_manage_time_requests = ?,
          can_approve_time_extensions = ?,
          can_reject_time_extensions = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [
        can_manage_users, (can_manage_users_view === true || can_manage_users_view === 1) ? 1 : 0, (can_manage_users_edit === true || can_manage_users_edit === 1) ? 1 : 0,
        can_manage_student_db, (can_manage_student_db_view === true || can_manage_student_db_view === 1) ? 1 : 0, (can_manage_student_db_edit === true || can_manage_student_db_edit === 1) ? 1 : 0,
        can_manage_profile_fields, (can_manage_profile_fields_view === true || can_manage_profile_fields_view === 1) ? 1 : 0, (can_manage_profile_fields_edit === true || can_manage_profile_fields_edit === 1) ? 1 : 0,
        can_manage_meetings, (can_manage_meetings_view === true || can_manage_meetings_view === 1) ? 1 : 0, (can_manage_meetings_edit === true || can_manage_meetings_edit === 1) ? 1 : 0,
        can_manage_events, (can_manage_events_view === true || can_manage_events_view === 1) ? 1 : 0, (can_manage_events_edit === true || can_manage_events_edit === 1) ? 1 : 0,
        can_manage_attendance, (can_manage_attendance_view === true || can_manage_attendance_view === 1) ? 1 : 0, (can_manage_attendance_edit === true || can_manage_attendance_edit === 1) ? 1 : 0,
        can_manage_bills, (can_manage_bills_view === true || can_manage_bills_view === 1) ? 1 : 0, (can_manage_bills_edit === true || can_manage_bills_edit === 1) ? 1 : 0,
        can_manage_projects, (can_manage_projects_view === true || can_manage_projects_view === 1) ? 1 : 0, (can_manage_projects_edit === true || can_manage_projects_edit === 1) ? 1 : 0,
        can_manage_resources, (can_manage_resources_view === true || can_manage_resources_view === 1) ? 1 : 0, (can_manage_resources_edit === true || can_manage_resources_edit === 1) ? 1 : 0,
        can_manage_volunteers, (can_manage_volunteers_view === true || can_manage_volunteers_view === 1) ? 1 : 0, (can_manage_volunteers_edit === true || can_manage_volunteers_edit === 1) ? 1 : 0,
        can_manage_messages, (can_manage_messages_view === true || can_manage_messages_view === 1) ? 1 : 0, (can_manage_messages_edit === true || can_manage_messages_edit === 1) ? 1 : 0,
        can_manage_students, (can_manage_students_view === true || can_manage_students_view === 1) ? 1 : 0, (can_manage_students_edit === true || can_manage_students_edit === 1) ? 1 : 0,
        can_manage_alumni, (can_manage_alumni_view === true || can_manage_alumni_view === 1) ? 1 : 0, (can_manage_alumni_edit === true || can_manage_alumni_edit === 1) ? 1 : 0,
        can_manage_feedback_questions, (can_manage_feedback_questions_view === true || can_manage_feedback_questions_view === 1) ? 1 : 0, (can_manage_feedback_questions_edit === true || can_manage_feedback_questions_edit === 1) ? 1 : 0,
        can_manage_feedback_reports, (can_manage_feedback_reports_view === true || can_manage_feedback_reports_view === 1) ? 1 : 0, (can_manage_feedback_reports_edit === true || can_manage_feedback_reports_edit === 1) ? 1 : 0,
        can_manage_permissions_module, (can_manage_permissions_module_view === true || can_manage_permissions_module_view === 1) ? 1 : 0, (can_manage_permissions_module_edit === true || can_manage_permissions_module_edit === 1) ? 1 : 0,
        can_manage_settings, (can_manage_settings_view === true || can_manage_settings_view === 1) ? 1 : 0, (can_manage_settings_edit === true || can_manage_settings_edit === 1) ? 1 : 0,
        can_view_analytics, (can_view_analytics_view === true || can_view_analytics_view === 1) ? 1 : 0, (can_view_analytics_edit === true || can_view_analytics_edit === 1) ? 1 : 0,
        (can_manage_time_requests === true || can_manage_time_requests === 1) ? 1 : 0,
        (can_approve_time_extensions === true || can_approve_time_extensions === 1) ? 1 : 0,
        (can_reject_time_extensions === true || can_reject_time_extensions === 1) ? 1 : 0,
        userId
      ]);
    } else {
      // Create new permission record including view/edit columns
      await run(db, `
        INSERT INTO permissions (
          user_id,
          can_manage_users, can_manage_users_view, can_manage_users_edit,
          can_manage_student_db, can_manage_student_db_view, can_manage_student_db_edit,
          can_manage_profile_fields, can_manage_profile_fields_view, can_manage_profile_fields_edit,
          can_manage_meetings, can_manage_meetings_view, can_manage_meetings_edit,
          can_manage_events, can_manage_events_view, can_manage_events_edit,
          can_manage_attendance, can_manage_attendance_view, can_manage_attendance_edit,
          can_manage_bills, can_manage_bills_view, can_manage_bills_edit,
          can_manage_projects, can_manage_projects_view, can_manage_projects_edit,
          can_manage_resources, can_manage_resources_view, can_manage_resources_edit,
          can_manage_volunteers, can_manage_volunteers_view, can_manage_volunteers_edit,
          can_manage_messages, can_manage_messages_view, can_manage_messages_edit,
          can_manage_students, can_manage_students_view, can_manage_students_edit,
          can_manage_alumni, can_manage_alumni_view, can_manage_alumni_edit,
          can_manage_feedback_questions, can_manage_feedback_questions_view, can_manage_feedback_questions_edit,
          can_manage_feedback_reports, can_manage_feedback_reports_view, can_manage_feedback_reports_edit,
          can_manage_permissions_module, can_manage_permissions_module_view, can_manage_permissions_module_edit,
          can_manage_settings, can_manage_settings_view, can_manage_settings_edit,
          can_view_analytics, can_view_analytics_view, can_view_analytics_edit,
          can_manage_time_requests,
          can_approve_time_extensions,
          can_reject_time_extensions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        can_manage_users, (can_manage_users_view === true || can_manage_users_view === 1) ? 1 : 0, (can_manage_users_edit === true || can_manage_users_edit === 1) ? 1 : 0,
        can_manage_student_db, (can_manage_student_db_view === true || can_manage_student_db_view === 1) ? 1 : 0, (can_manage_student_db_edit === true || can_manage_student_db_edit === 1) ? 1 : 0,
        can_manage_profile_fields, (can_manage_profile_fields_view === true || can_manage_profile_fields_view === 1) ? 1 : 0, (can_manage_profile_fields_edit === true || can_manage_profile_fields_edit === 1) ? 1 : 0,
        can_manage_meetings, (can_manage_meetings_view === true || can_manage_meetings_view === 1) ? 1 : 0, (can_manage_meetings_edit === true || can_manage_meetings_edit === 1) ? 1 : 0,
        can_manage_events, (can_manage_events_view === true || can_manage_events_view === 1) ? 1 : 0, (can_manage_events_edit === true || can_manage_events_edit === 1) ? 1 : 0,
        can_manage_attendance, (can_manage_attendance_view === true || can_manage_attendance_view === 1) ? 1 : 0, (can_manage_attendance_edit === true || can_manage_attendance_edit === 1) ? 1 : 0,
        can_manage_bills, (can_manage_bills_view === true || can_manage_bills_view === 1) ? 1 : 0, (can_manage_bills_edit === true || can_manage_bills_edit === 1) ? 1 : 0,
        can_manage_projects, (can_manage_projects_view === true || can_manage_projects_view === 1) ? 1 : 0, (can_manage_projects_edit === true || can_manage_projects_edit === 1) ? 1 : 0,
        can_manage_resources, (can_manage_resources_view === true || can_manage_resources_view === 1) ? 1 : 0, (can_manage_resources_edit === true || can_manage_resources_edit === 1) ? 1 : 0,
        can_manage_volunteers, (can_manage_volunteers_view === true || can_manage_volunteers_view === 1) ? 1 : 0, (can_manage_volunteers_edit === true || can_manage_volunteers_edit === 1) ? 1 : 0,
        can_manage_messages, (can_manage_messages_view === true || can_manage_messages_view === 1) ? 1 : 0, (can_manage_messages_edit === true || can_manage_messages_edit === 1) ? 1 : 0,
        can_manage_students, (can_manage_students_view === true || can_manage_students_view === 1) ? 1 : 0, (can_manage_students_edit === true || can_manage_students_edit === 1) ? 1 : 0,
        can_manage_alumni, (can_manage_alumni_view === true || can_manage_alumni_view === 1) ? 1 : 0, (can_manage_alumni_edit === true || can_manage_alumni_edit === 1) ? 1 : 0,
        can_manage_feedback_questions, (can_manage_feedback_questions_view === true || can_manage_feedback_questions_view === 1) ? 1 : 0, (can_manage_feedback_questions_edit === true || can_manage_feedback_questions_edit === 1) ? 1 : 0,
        can_manage_feedback_reports, (can_manage_feedback_reports_view === true || can_manage_feedback_reports_view === 1) ? 1 : 0, (can_manage_feedback_reports_edit === true || can_manage_feedback_reports_edit === 1) ? 1 : 0,
        can_manage_permissions_module, (can_manage_permissions_module_view === true || can_manage_permissions_module_view === 1) ? 1 : 0, (can_manage_permissions_module_edit === true || can_manage_permissions_module_edit === 1) ? 1 : 0,
        can_manage_settings, (can_manage_settings_view === true || can_manage_settings_view === 1) ? 1 : 0, (can_manage_settings_edit === true || can_manage_settings_edit === 1) ? 1 : 0,
        can_view_analytics, (can_view_analytics_view === true || can_view_analytics_view === 1) ? 1 : 0, (can_view_analytics_edit === true || can_view_analytics_edit === 1) ? 1 : 0,
        (can_manage_time_requests === true || can_manage_time_requests === 1) ? 1 : 0,
        (can_approve_time_extensions === true || can_approve_time_extensions === 1) ? 1 : 0,
        (can_reject_time_extensions === true || can_reject_time_extensions === 1) ? 1 : 0
      ]);
    }

    res.json({ success: true, message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

