import express from 'express';
import { body, validationResult } from 'express-validator';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Helper functions
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
      else resolve(rows || []);
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

// ============================================
// SPOC ASSIGNMENT MANAGEMENT (Admin Only)
// ============================================

// POST - Assign SPOC to project/event
router.post('/assign', authenticateToken, requireRole('admin'), [
  body('spoc_id').isInt().withMessage('SPOC ID is required'),
  body('project_id').optional().isInt(),
  body('event_id').optional().isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const db = getDatabase();
    const { spoc_id, project_id, event_id } = req.body;

    // Must have either project_id or event_id, not both
    if (!project_id && !event_id) {
      return res.status(400).json({
        success: false,
        message: 'Either project_id or event_id is required'
      });
    }

    if (project_id && event_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign to both project and event. Choose one.'
      });
    }

    // Verify SPOC exists and has correct role
    const spoc = await get(db, 'SELECT id, name, role FROM users WHERE id = ? AND role = ?', [spoc_id, 'spoc']);
    if (!spoc) {
      return res.status(404).json({
        success: false,
        message: 'SPOC not found or user is not a SPOC'
      });
    }

    // Verify project/event exists
    if (project_id) {
      const project = await get(db, 'SELECT id, title FROM projects WHERE id = ?', [project_id]);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
    }

    if (event_id) {
      const event = await get(db, 'SELECT id, title FROM events WHERE id = ?', [event_id]);
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
    }

    // Check if assignment already exists
    let existing;
    if (project_id) {
      existing = await get(
        db,
        'SELECT id FROM spoc_assignments WHERE spoc_id = ? AND project_id = ?',
        [spoc_id, project_id]
      );
    } else {
      existing = await get(
        db,
        'SELECT id FROM spoc_assignments WHERE spoc_id = ? AND event_id = ?',
        [spoc_id, event_id]
      );
    }

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'SPOC is already assigned to this project/event'
      });
    }

    // Create assignment
    const result = await run(
      db,
      'INSERT INTO spoc_assignments (spoc_id, project_id, event_id, assigned_by) VALUES (?, ?, ?, ?)',
      [spoc_id, project_id || null, event_id || null, req.user.id]
    );

    res.json({
      success: true,
      message: 'SPOC assigned successfully',
      assignmentId: result.lastID
    });
  } catch (error) {
    console.error('Assign SPOC error:', error);
    res.status(500).json({ success: false, message: 'Error assigning SPOC', error: error.message });
  }
});

// GET - Get all SPOC assignments (Admin only)
router.get('/assignments', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();

    const assignments = await all(db, `
      SELECT 
        sa.id,
        sa.spoc_id,
        sa.project_id,
        sa.event_id,
        sa.assigned_at,
        sa.assigned_by,
        u.name as spoc_name,
        u.email as spoc_email,
        p.title as project_title,
        e.title as event_title,
        e.date as event_date,
        assigner.name as assigned_by_name
      FROM spoc_assignments sa
      JOIN users u ON sa.spoc_id = u.id
      LEFT JOIN projects p ON sa.project_id = p.id
      LEFT JOIN events e ON sa.event_id = e.id
      LEFT JOIN users assigner ON sa.assigned_by = assigner.id
      ORDER BY sa.assigned_at DESC
    `);

    res.json({ success: true, assignments });
  } catch (error) {
    console.error('Get SPOC assignments error:', error);
    res.status(500).json({ success: false, message: 'Error fetching assignments', error: error.message });
  }
});

// GET - Get SPOC's assigned projects/events
router.get('/my-assignments', authenticateToken, requireRole('spoc'), async (req, res) => {
  try {
    const db = getDatabase();
    const spocId = req.user.id;

    const assignments = await all(db, `
      SELECT 
        sa.id,
        sa.project_id,
        sa.event_id,
        sa.assigned_at,
        p.title as project_title,
        p.description as project_description,
        p.start_date as project_start_date,
        p.end_date as project_end_date,
        p.status as project_status,
        e.title as event_title,
        e.description as event_description,
        e.date as event_date,
        e.year as event_year
      FROM spoc_assignments sa
      LEFT JOIN projects p ON sa.project_id = p.id
      LEFT JOIN events e ON sa.event_id = e.id
      WHERE sa.spoc_id = ?
      ORDER BY sa.assigned_at DESC
    `, [spocId]);

    res.json({ success: true, assignments });
  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ success: false, message: 'Error fetching assignments', error: error.message });
  }
});

// DELETE - Remove SPOC assignment (Admin only)
router.delete('/assignments/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const assignment = await get(db, 'SELECT id FROM spoc_assignments WHERE id = ?', [id]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    await run(db, 'DELETE FROM spoc_assignments WHERE id = ?', [id]);

    res.json({ success: true, message: 'Assignment removed successfully' });
  } catch (error) {
    console.error('Remove SPOC assignment error:', error);
    res.status(500).json({ success: false, message: 'Error removing assignment', error: error.message });
  }
});

// GET - Get all SPOCs (for assignment dropdown)
router.get('/list', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();

    const spocs = await all(db, `
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(sa.id) as assignment_count
      FROM users u
      LEFT JOIN spoc_assignments sa ON u.id = sa.spoc_id
      WHERE u.role = 'spoc'
      GROUP BY u.id, u.name, u.email
      ORDER BY u.name
    `);

    res.json({ success: true, spocs });
  } catch (error) {
    console.error('Get SPOCs list error:', error);
    res.status(500).json({ success: false, message: 'Error fetching SPOCs', error: error.message });
  }
});

export default router;
