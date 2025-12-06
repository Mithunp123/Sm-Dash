import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken } from '../middleware/auth.js';
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

// Get time allotments
router.get('/allotments', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { userId, projectId } = req.query;

    let query = `
      SELECT ta.*, u.name as user_name, p.title as project_title
      FROM time_allotments ta
      JOIN users u ON ta.user_id = u.id
      LEFT JOIN projects p ON ta.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      query += ' AND ta.user_id = ?';
      params.push(userId);
    }

    if (projectId) {
      query += ' AND ta.project_id = ?';
      params.push(projectId);
    }

    query += ' ORDER BY ta.date DESC';

    const allotments = await all(db, query, params);
    res.json({ success: true, allotments });
  } catch (error) {
    console.error('Get time allotments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create time allotment
router.post('/allotments', authenticateToken, [
  body('userId').isInt(),
  body('hours').isInt({ min: 1 }),
  body('date').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId, projectId, hours, date, description } = req.body;
    const db = getDatabase();

    const result = await run(db,
      'INSERT INTO time_allotments (user_id, project_id, hours, date, description) VALUES (?, ?, ?, ?, ?)',
      [userId, projectId || null, hours, date, description || null]
    );

    res.json({ success: true, message: 'Time allotment created successfully', id: result.lastID });
  } catch (error) {
    console.error('Create time allotment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get time requests
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { userId, status } = req.query;

    let query = `
      SELECT tr.*, u.name as user_name, p.title as project_title, u2.name as approved_by_name
      FROM time_requests tr
      JOIN users u ON tr.user_id = u.id
      LEFT JOIN projects p ON tr.project_id = p.id
      LEFT JOIN users u2 ON tr.approved_by = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      query += ' AND tr.user_id = ?';
      params.push(userId);
    }

    if (status) {
      query += ' AND tr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY tr.created_at DESC';

    const requests = await all(db, query, params);
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get time requests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create time request
router.post('/requests', authenticateToken, [
  body('hours').isInt({ min: 1 }),
  body('date').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { projectId, hours, date, deadline, description } = req.body;
    const db = getDatabase();

    const result = await run(db,
      'INSERT INTO time_requests (user_id, project_id, hours, date, deadline, description) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, projectId || null, hours, date, deadline || null, description || null]
    );

    res.json({ success: true, message: 'Time request submitted successfully', id: result.lastID });
  } catch (error) {
    console.error('Create time request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve/Reject time request
router.put('/requests/:id', authenticateToken, [
  body('status').isIn(['approved', 'rejected'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const db = getDatabase();
    const request = await get(db, 'SELECT * FROM time_requests WHERE id = ?', [req.params.id]);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Time request not found' });
    }

    await run(db,
      'UPDATE time_requests SET status = ?, approved_by = ? WHERE id = ?',
      [req.body.status, req.user.id, req.params.id]
    );

    // If approved, create time allotment
    if (req.body.status === 'approved') {
      await run(db,
        'INSERT INTO time_allotments (user_id, project_id, hours, date, description) VALUES (?, ?, ?, ?, ?)',
        [request.user_id, request.project_id, request.hours, request.date, request.description]
      );
    }

    res.json({ success: true, message: `Time request ${req.body.status} successfully` });
  } catch (error) {
    console.error('Update time request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

