import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

const get = (db, query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
});
const all = (db, query, params = []) => new Promise((resolve, reject) => {
  db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const run = (db, query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function(err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

// Create a permission request (authenticated users)
router.post('/', authenticateToken, [
  body('permission_key').isString().notEmpty(),
  body('message').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDatabase();
    const userId = req.user.id;
    const { permission_key, message } = req.body;

    // Only allow office_bearer users to request management permissions (or admin to post on behalf)
    const user = await get(db, 'SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role !== 'office_bearer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only office bearers can request permissions' });
    }

    // Insert request
    const result = await run(db, 'INSERT INTO permission_requests (user_id, permission_key, message) VALUES (?, ?, ?)', [userId, permission_key, message || null]);

    res.json({ success: true, message: 'Request submitted', requestId: result.lastID });
  } catch (error) {
    console.error('Create permission request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all permission requests (admin only)
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const rows = await all(db, `
      SELECT pr.*, u.name, u.email
      FROM permission_requests pr
      JOIN users u ON pr.user_id = u.id
      ORDER BY pr.created_at DESC
    `);
    res.json({ success: true, requests: rows });
  } catch (error) {
    console.error('Get permission requests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Process a request (approve/reject) - admin only
router.put('/:id', authenticateToken, requireRole('admin'), [
  body('status').isIn(['approved', 'rejected'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDatabase();
    const { id } = req.params;
    const { status } = req.body;
    const processedBy = req.user.id;

    const existing = await get(db, 'SELECT * FROM permission_requests WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
    if (existing.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already processed' });

    // Update request
    await run(db, 'UPDATE permission_requests SET status = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, processedBy, id]);

    // If approved, set corresponding permission column on permissions table for that user
    if (status === 'approved') {
      const permKey = existing.permission_key; // e.g. 'can_manage_student_db_edit'
      // Ensure the column exists in permissions table (init script should have added edit columns)
      // Upsert permissions row and set the column to 1
      const permRow = await get(db, 'SELECT * FROM permissions WHERE user_id = ?', [existing.user_id]);
      if (permRow) {
        try {
          await run(db, `UPDATE permissions SET ${permKey} = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [existing.user_id]);
        } catch (e) {
          console.error('Failed to update permissions column', e);
        }
      } else {
        // Create a new permissions row with the column set
        // Build column list and values dynamically
        const baseCols = ['user_id', permKey];
        const basePlaceholders = ['?', '?'];
        const values = [existing.user_id, 1];
        try {
          await run(db, `INSERT INTO permissions (${baseCols.join(',')}) VALUES (${basePlaceholders.join(',')})`, values);
        } catch (e) {
          console.error('Failed to insert permissions row', e);
        }
      }
    }

    res.json({ success: true, message: 'Request processed' });
  } catch (error) {
    console.error('Process permission request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
