import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
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

// Get all bills
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const bills = await all(db, `
      SELECT b.*, 
             u1.name as submitted_by_name,
             u2.name as approved_by_name,
             p.title as project_title
      FROM bills b
      LEFT JOIN users u1 ON b.submitted_by = u1.id
      LEFT JOIN users u2 ON b.approved_by = u2.id
      LEFT JOIN projects p ON b.project_id = p.id
      ORDER BY b.created_at DESC
    `);

    // Attach itemized entries for each bill (include transport from/to fields)
    for (const bill of bills) {
      try {
        const items = await all(db, 'SELECT id, category, description, amount, from_loc as from, to_loc as to FROM bill_items WHERE bill_id = ?', [bill.id]);
        bill.items = items || [];
      } catch (e) {
        bill.items = [];
      }
      bill.amount = Number(bill.amount || 0);
    }

    res.json({ success: true, bills });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create bill
router.post('/', authenticateToken, [
  body('title').notEmpty().trim(),
  body('amount').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { title, amount, description, bill_date, project_id, bill_type, drive_link, items } = req.body;
    const db = getDatabase();

    // If items provided, calculate total from them; otherwise fallback to amount
    let totalAmount = 0;
    if (Array.isArray(items) && items.length > 0) {
      totalAmount = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
    } else {
      totalAmount = parseFloat(amount) || 0;
    }

    const result = await run(db,
      'INSERT INTO bills (title, amount, description, bill_date, project_id, submitted_by, bill_type, drive_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, totalAmount, description || null, bill_date || new Date().toISOString().split('T')[0], project_id || null, req.user.id, bill_type || null, drive_link || null]
    );

    // Insert items if provided (support optional from/to for transport items)
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const fromLoc = it.from || it.from_loc || null;
        const toLoc = it.to || it.to_loc || null;
        await run(db, 'INSERT INTO bill_items (bill_id, category, description, amount, from_loc, to_loc) VALUES (?, ?, ?, ?, ?, ?)', [result.lastID, it.category || 'other', it.description || null, parseFloat(it.amount) || 0, fromLoc, toLoc]);
      }
    }

    res.json({ success: true, message: 'Bill submitted successfully', id: result.lastID });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update bill (owner or admin)
router.put('/:id', authenticateToken, [
  body('title').optional().trim(),
  body('amount').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const db = getDatabase();
    const bill = await get(db, 'SELECT * FROM bills WHERE id = ?', [req.params.id]);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    // Only admin or the user who submitted can update
    if (req.user.role !== 'admin' && bill.submitted_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updates = [];
    const params = [];

    if (req.body.title !== undefined) { updates.push('title = ?'); params.push(req.body.title); }
    if (req.body.description !== undefined) { updates.push('description = ?'); params.push(req.body.description); }
    if (req.body.bill_date !== undefined) { updates.push('bill_date = ?'); params.push(req.body.bill_date); }
    if (req.body.bill_type !== undefined) { updates.push('bill_type = ?'); params.push(req.body.bill_type); }
    if (req.body.amount !== undefined) { updates.push('amount = ?'); params.push(req.body.amount); }
    if (req.body.project_id !== undefined) { updates.push('project_id = ?'); params.push(req.body.project_id); }
    if (req.body.drive_link !== undefined) { updates.push('drive_link = ?'); params.push(req.body.drive_link); }

    // Handle items update separately if provided
    if (Array.isArray(req.body.items)) {
      // Replace existing items for this bill
      await run(db, 'DELETE FROM bill_items WHERE bill_id = ?', [req.params.id]);
      for (const it of req.body.items) {
        const fromLoc = it.from || it.from_loc || null;
        const toLoc = it.to || it.to_loc || null;
        await run(db, 'INSERT INTO bill_items (bill_id, category, description, amount, from_loc, to_loc) VALUES (?, ?, ?, ?, ?, ?)', [req.params.id, it.category || 'other', it.description || null, parseFloat(it.amount) || 0, fromLoc, toLoc]);
      }

      // Recalculate amount from items and include in updates
      const recalculated = req.body.items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
      updates.push('amount = ?'); params.push(recalculated);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(req.params.id);

    await run(db, `UPDATE bills SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Bill updated successfully' });
  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve/Reject bill (Admin/Office Bearer only)
router.put('/:id/approve', authenticateToken, requireRole('admin', 'office_bearer'), [
  body('status').isIn(['approved', 'rejected'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const db = getDatabase();
    const bill = await get(db, 'SELECT * FROM bills WHERE id = ?', [req.params.id]);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    await run(db,
      'UPDATE bills SET status = ?, approved_by = ? WHERE id = ?',
      [req.body.status, req.user.id, req.params.id]
    );

    res.json({ success: true, message: `Bill ${req.body.status} successfully` });
  } catch (error) {
    console.error('Approve bill error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete bill (owner or admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const bill = await get(db, 'SELECT * FROM bills WHERE id = ?', [req.params.id]);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    // Only admin or the user who submitted can delete
    if (req.user.role !== 'admin' && bill.submitted_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Remove associated items explicitly (foreign key cascade may handle it if enabled)
    await run(db, 'DELETE FROM bill_items WHERE bill_id = ?', [req.params.id]);
    await run(db, 'DELETE FROM bills WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

