import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getDatabase } from '../database/init.js';

const router = express.Router();

const awardsDir = path.join(process.cwd(), 'public', 'uploads', 'awards');
fs.mkdirSync(awardsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, awardsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `award-${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });
const toUrlPath = (filename) => (filename ? `/uploads/awards/${filename}` : null);

// Public list
router.get('/public', (req, res) => {
  const db = getDatabase();
  db.all('SELECT * FROM awards ORDER BY award_date DESC, created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, awards: rows || [] });
  });
});

// Admin list (optional year filter)
router.get('/', authenticateToken, requireRole('admin', 'office_bearer'), (req, res) => {
  const db = getDatabase();
  const { year } = req.query;
  const params = [];
  let query = 'SELECT * FROM awards';
  if (year) {
    query += ' WHERE year = ?';
    params.push(year);
  }
  query += ' ORDER BY award_date DESC, created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, awards: rows || [] });
  });
});

// Single award
router.get('/:id', authenticateToken, requireRole('admin', 'office_bearer'), (req, res) => {
  const db = getDatabase();
  db.get('SELECT * FROM awards WHERE id = ?', [req.params.id], (err, award) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    if (!award) {
      return res.status(404).json({ success: false, message: 'Award not found' });
    }
    res.json({ success: true, award });
  });
});

// Create award
router.post('/', authenticateToken, requireRole('admin', 'office_bearer'), upload.single('image'), (req, res) => {
  const db = getDatabase();
  const { title, description, recipient_name, recipient_id, award_date, year, category } = req.body;
  const imageUrl = req.file ? toUrlPath(req.file.filename) : null;

  if (!title) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ success: false, message: 'Title is required' });
  }

  db.run(
    `INSERT INTO awards (title, description, recipient_name, recipient_id, award_date, year, category, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description || null, recipient_name || null, recipient_id || null, award_date || null, year || null, category || null, imageUrl],
    function (err) {
      if (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(500).json({ success: false, message: 'Error creating award', error: err.message });
      }
      res.json({ success: true, message: 'Award created', id: this.lastID });
    }
  );
});

// Update award
router.put('/:id', authenticateToken, requireRole('admin', 'office_bearer'), upload.single('image'), (req, res) => {
  const db = getDatabase();
  const { title, description, recipient_name, recipient_id, award_date, year, category } = req.body;

  db.get('SELECT * FROM awards WHERE id = ?', [req.params.id], (findErr, existing) => {
    if (findErr) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(500).json({ success: false, message: 'Database error', error: findErr.message });
    }
    if (!existing) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ success: false, message: 'Award not found' });
    }

    let finalImage = existing.image_url;
    if (req.file) {
      if (existing.image_url) {
        const oldPath = path.join(process.cwd(), 'public', existing.image_url);
        fs.unlink(oldPath, () => {});
      }
      finalImage = toUrlPath(req.file.filename);
    }

    db.run(
      `UPDATE awards
       SET title = ?, description = ?, recipient_name = ?, recipient_id = ?, award_date = ?, year = ?, category = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title || existing.title, description || null, recipient_name || null, recipient_id || null, award_date || null, year || null, category || null, finalImage, req.params.id],
      (err) => {
        if (err) {
          if (req.file) fs.unlink(req.file.path, () => {});
          return res.status(500).json({ success: false, message: 'Error updating award', error: err.message });
        }
        res.json({ success: true, message: 'Award updated' });
      }
    );
  });
});

// Delete award
router.delete('/:id', authenticateToken, requireRole('admin', 'office_bearer'), (req, res) => {
  const db = getDatabase();

  db.get('SELECT * FROM awards WHERE id = ?', [req.params.id], (findErr, existing) => {
    if (findErr) {
      return res.status(500).json({ success: false, message: 'Database error', error: findErr.message });
    }
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Award not found' });
    }

    if (existing.image_url) {
      const oldPath = path.join(process.cwd(), 'public', existing.image_url);
      fs.unlink(oldPath, () => {});
    }

    db.run('DELETE FROM awards WHERE id = ?', [req.params.id], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Error deleting award', error: err.message });
      }
      res.json({ success: true, message: 'Award deleted' });
    });
  });
});

export default router;
