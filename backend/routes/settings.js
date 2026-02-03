import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.js';
const router = express.Router();
import { logActivity } from '../utils/logger.js';


const all = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const get = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const run = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Get profile field settings (all fields: predefined + custom)
router.get('/profile-fields', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const rows = await all(db, 'SELECT id, field_name, label, field_type, editable_by_student, visible, is_custom FROM profile_field_settings ORDER BY is_custom, id');
    res.json({ success: true, fields: rows });
  } catch (error) {
    console.error('Get profile fields error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update profile field settings (admin only)
router.put('/profile-fields', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const updates = req.body.fields || [];
    const db = getDatabase();
    for (const f of updates) {
      await run(db, 'UPDATE profile_field_settings SET editable_by_student = ?, visible = ?, updated_at = CURRENT_TIMESTAMP WHERE field_name = ?', [f.editable_by_student ? 1 : 0, f.visible ? 1 : 0, f.field_name]);
    }
    const rows = await all(db, 'SELECT id, field_name, label, field_type, editable_by_student, visible, is_custom FROM profile_field_settings ORDER BY is_custom, id');

    await logActivity(req.user.id, 'UPDATE_PROFILE_FIELD_SETTINGS', { updates }, req, {
      action_type: 'UPDATE',
      module_name: 'settings',
      action_description: 'Updated profile field visibility/editability settings'
    });

    res.json({ success: true, fields: rows });
  } catch (error) {
    console.error('Update profile fields error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add custom profile field (admin only)
router.post('/profile-fields', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { label, field_type = 'text' } = req.body;
    if (!label) {
      return res.status(400).json({ success: false, message: 'Label is required' });
    }

    const db = getDatabase();
    // Generate field_name from label (lowercase, replace spaces with underscore)
    const field_name = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    // Check if field already exists
    const exists = await get(db, 'SELECT id FROM profile_field_settings WHERE field_name = ?', [field_name]);
    if (exists) {
      return res.status(400).json({ success: false, message: 'Field with this name already exists' });
    }

    // Insert custom field
    const result = await run(db,
      'INSERT INTO profile_field_settings (field_name, label, field_type, editable_by_student, visible, is_custom) VALUES (?, ?, ?, ?, ?, ?)',
      [field_name, label, field_type, 1, 1, 1]
    );

    // Add role-level settings for all roles (SPOC removed)
    const roles = ['student', 'office_bearer'];
    for (const r of roles) {
      const canEdit = r === 'student' ? 1 : 1; // Custom fields editable by all by default
      await run(db,
        'INSERT INTO role_profile_field_settings (role, field_name, can_view, can_edit) VALUES (?, ?, ?, ?)',
        [r, field_name, 1, canEdit]
      );
    }

    const rows = await all(db, 'SELECT id, field_name, label, field_type, editable_by_student, visible, is_custom FROM profile_field_settings ORDER BY is_custom, id');

    await logActivity(req.user.id, 'ADD_PROFILE_FIELD', { label, field_type }, req, {
      action_type: 'CREATE',
      module_name: 'settings',
      action_description: `Added custom profile field: ${label}`,
      reference_id: field_name
    });

    res.json({ success: true, message: 'Field added successfully', fields: rows });
  } catch (error) {
    console.error('Add profile field error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete custom profile field (admin only)
router.delete('/profile-fields/:field_name', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { field_name } = req.params;
    const db = getDatabase();

    // Check if field is custom (can only delete custom fields)
    const field = await get(db, 'SELECT is_custom FROM profile_field_settings WHERE field_name = ?', [field_name]);
    if (!field) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }
    if (!field.is_custom) {
      return res.status(400).json({ success: false, message: 'Cannot delete predefined fields' });
    }

    // Delete field and its role settings
    await run(db, 'DELETE FROM profile_field_settings WHERE field_name = ?', [field_name]);
    await run(db, 'DELETE FROM role_profile_field_settings WHERE field_name = ?', [field_name]);

    const rows = await all(db, 'SELECT id, field_name, label, field_type, editable_by_student, visible, is_custom FROM profile_field_settings ORDER BY is_custom, id');

    await logActivity(req.user.id, 'DELETE_PROFILE_FIELD', { field_name }, req, {
      action_type: 'DELETE',
      module_name: 'settings',
      action_description: `Deleted custom profile field: ${field_name}`,
      reference_id: field_name
    });

    res.json({ success: true, message: 'Field deleted successfully', fields: rows });
  } catch (error) {
    console.error('Delete profile field error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Role-level profile field permissions
router.get('/role-profile-fields', authenticateToken, requirePermission('can_manage_permissions_module'), async (req, res) => {
  try {
    const db = getDatabase();
    const rows = await all(db, 'SELECT role, field_name, can_view, can_edit FROM role_profile_field_settings ORDER BY role, field_name');
    res.json({ success: true, rows });
  } catch (error) {
    console.error('Get role profile fields error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/role-profile-fields', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const updates = req.body.rows || [];
    const db = getDatabase();
    for (const u of updates) {
      await run(db, 'UPDATE role_profile_field_settings SET can_view = ?, can_edit = ?, updated_at = CURRENT_TIMESTAMP WHERE role = ? AND field_name = ?', [u.can_view ? 1 : 0, u.can_edit ? 1 : 0, u.role, u.field_name]);
    }
    const rows = await all(db, 'SELECT role, field_name, can_view, can_edit FROM role_profile_field_settings ORDER BY role, field_name');
    res.json({ success: true, rows });
  } catch (error) {
    console.error('Update role profile fields error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
