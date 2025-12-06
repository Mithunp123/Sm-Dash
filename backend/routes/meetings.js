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

// Get all meetings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const meetings = await all(db, `
      SELECT m.*, u.name as organizer_name
      FROM meetings m
      LEFT JOIN users u ON m.organizer_id = u.id
      ORDER BY m.date DESC
    `);
    res.json({ success: true, meetings });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get meeting by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const meeting = await get(db, `
      SELECT m.*, u.name as organizer_name
      FROM meetings m
      LEFT JOIN users u ON m.organizer_id = u.id
      WHERE m.id = ?
    `, [req.params.id]);

    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    res.json({ success: true, meeting });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create meeting
router.post('/', authenticateToken, [
  body('title').notEmpty().trim(),
  body('date').notEmpty(),
  body('location').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, date, location } = req.body;
    const db = getDatabase();

    const result = await run(db,
      'INSERT INTO meetings (title, description, date, location, organizer_id) VALUES (?, ?, ?, ?, ?)',
      [title, description || null, date, location || null, req.user.id]
    );

    res.json({ success: true, message: 'Meeting created successfully', id: result.lastID });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update meeting
router.put('/:id', authenticateToken, [
  body('title').optional().notEmpty().trim(),
  body('status').optional().isIn(['scheduled', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const db = getDatabase();
    const meeting = await get(db, 'SELECT * FROM meetings WHERE id = ?', [req.params.id]);

    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const updates = [];
    const params = [];

    if (req.body.title) {
      updates.push('title = ?');
      params.push(req.body.title);
    }
    if (req.body.description !== undefined) {
      updates.push('description = ?');
      params.push(req.body.description);
    }
    if (req.body.date) {
      updates.push('date = ?');
      params.push(req.body.date);
    }
    if (req.body.location !== undefined) {
      updates.push('location = ?');
      params.push(req.body.location);
    }
    if (req.body.status) {
      updates.push('status = ?');
      params.push(req.body.status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(req.params.id);

    await run(db, `UPDATE meetings SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Meeting updated successfully' });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete meeting
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const meeting = await get(db, 'SELECT * FROM meetings WHERE id = ?', [req.params.id]);

    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    await run(db, 'DELETE FROM meetings WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

