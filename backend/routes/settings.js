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

// Database Backup (Admin only)
router.get('/backup/export', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const tables = await all(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'activity_logs' ORDER BY name");
    // If MySQL, we get tables differently
    let tableNames = [];
    if (process.env.DB_TYPE === 'mysql') {
      const rows = await all(db, "SHOW TABLES");
      const dbName = process.env.DB_NAME;
      tableNames = rows.map(r => r[`Tables_in_${dbName}`]).filter(name => name !== 'activity_logs');
    } else {
      tableNames = tables.map(t => t.name);
    }

    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {}
    };

    for (const tableName of tableNames) {
      backupData.data[tableName] = await all(db, `SELECT * FROM ${tableName}`);
    }

    await logActivity(req.user.id, 'DATABASE_BACKUP_EXPORT', {}, req, {
      action_type: 'EXPORT',
      module_name: 'settings',
      action_description: 'Exported database backup'
    });

    res.json({ success: true, backup: backupData });
  } catch (error) {
    console.error('Backup export error:', error);
    res.status(500).json({ success: false, message: 'Backup failed: ' + error.message });
  }
});

// Database Restore (Admin only)
router.post('/backup/restore', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { backup } = req.body;
    if (!backup || !backup.data) {
      return res.status(400).json({ success: false, message: 'Invalid backup data' });
    }

    const db = getDatabase();
    const tableNames = Object.keys(backup.data);

    // Process each table
    for (const tableName of tableNames) {
      const rows = backup.data[tableName];
      if (!rows || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');

      // Note: We use INSERT IGNORE for MySQL and INSERT OR IGNORE for SQLite
      const prefix = process.env.DB_TYPE === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
      const query = `${prefix} INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map(col => row[col]);
        await run(db, query, values);
      }
    }

    await logActivity(req.user.id, 'DATABASE_BACKUP_RESTORE', { tables: tableNames }, req, {
      action_type: 'IMPORT',
      module_name: 'settings',
      action_description: 'Restored database from backup'
    });

    res.json({ success: true, message: 'Restore completed successfully' });
  } catch (error) {
    console.error('Backup restore error:', error);
    res.status(500).json({ success: false, message: 'Restore failed: ' + error.message });
  }
});

export default router;
