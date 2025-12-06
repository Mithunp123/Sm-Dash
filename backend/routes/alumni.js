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

// Get all alumni
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const alumni = await all(db, `
      SELECT a.*, u.name, u.email
      FROM alumni a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.graduation_year DESC, u.name ASC
    `);
    res.json({ success: true, alumni });
  } catch (error) {
    console.error('Get alumni error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get alumni by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const alumni = await get(db, `
      SELECT a.*, u.name, u.email
      FROM alumni a
      JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
    `, [req.params.id]);

    if (!alumni) {
      return res.status(404).json({ success: false, message: 'Alumni not found' });
    }

    res.json({ success: true, alumni });
  } catch (error) {
    console.error('Get alumni error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create/Update alumni profile
router.post('/', authenticateToken, [
  body('userId').isInt(),
  body('graduation_year').optional().isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId, graduation_year, current_position, company, achievements, contact_email, linkedin_url } = req.body;
    const db = getDatabase();

    // Check if alumni profile exists
    const existing = await get(db, 'SELECT id FROM alumni WHERE user_id = ?', [userId]);

    if (existing) {
      // Update existing
      await run(db,
        `UPDATE alumni SET 
         graduation_year = ?, current_position = ?, company = ?, achievements = ?, 
         contact_email = ?, linkedin_url = ?
         WHERE user_id = ?`,
        [graduation_year || null, current_position || null, company || null, achievements || null, 
         contact_email || null, linkedin_url || null, userId]
      );
      res.json({ success: true, message: 'Alumni profile updated successfully', id: existing.id });
    } else {
      // Create new
      const result = await run(db,
        `INSERT INTO alumni (user_id, graduation_year, current_position, company, achievements, contact_email, linkedin_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, graduation_year || null, current_position || null, company || null, achievements || null, 
         contact_email || null, linkedin_url || null]
      );
      res.json({ success: true, message: 'Alumni profile created successfully', id: result.lastID });
    }
  } catch (error) {
    console.error('Create alumni error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

