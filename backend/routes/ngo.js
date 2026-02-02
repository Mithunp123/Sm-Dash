import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getDatabase } from '../database/init.js';

const router = express.Router();

const ngoDir = path.join(process.cwd(), 'public', 'uploads', 'ngo');
fs.mkdirSync(ngoDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ngoDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `ngo-logo-${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });
const toUrlPath = (filename) => (filename ? `/uploads/ngo/${filename}` : null);

// Public list
router.get('/public', (req, res) => {
  const db = getDatabase();
  db.all('SELECT * FROM ngo_info ORDER BY updated_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    res.json({ success: true, ngos: rows || [] });
  });
});

// Authenticated list
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  db.all('SELECT * FROM ngo_info ORDER BY updated_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    res.json({ success: true, ngos: rows || [] });
  });
});

// Single NGO
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  db.get('SELECT * FROM ngo_info WHERE id = ?', [req.params.id], (err, ngo) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    if (!ngo) return res.status(404).json({ success: false, message: 'NGO not found' });
    res.json({ success: true, ngo });
  });
});

// Create NGO
router.post('/', authenticateToken, requireRole('admin', 'office_bearer'), upload.single('logo'), (req, res) => {
  const db = getDatabase();
  const { name, about, work, projects, events, profile, contact_email, contact_phone, address, website } = req.body;
  const logoUrl = req.file ? toUrlPath(req.file.filename) : null;

  if (!name) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ success: false, message: 'NGO name is required' });
  }

  db.run(
    `INSERT INTO ngo_info (name, about, work, projects, events, profile, logo_url, contact_email, contact_phone, address, website)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, about || null, work || null, projects || null, events || null, profile || null, logoUrl, contact_email || null, contact_phone || null, address || null, website || null],
    function (err) {
      if (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(500).json({ success: false, message: 'Error creating NGO', error: err.message });
      }
      res.json({ success: true, message: 'NGO created', id: this.lastID });
    }
  );
});

// Update NGO
router.put('/:id', authenticateToken, requireRole('admin', 'office_bearer'), upload.single('logo'), (req, res) => {
  const db = getDatabase();
  const { name, about, work, projects, events, profile, contact_email, contact_phone, address, website } = req.body;

  db.get('SELECT * FROM ngo_info WHERE id = ?', [req.params.id], (findErr, existing) => {
    if (findErr) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(500).json({ success: false, message: 'Database error', error: findErr.message });
    }
    if (!existing) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }

    let finalLogo = existing.logo_url;
    if (req.file) {
      if (existing.logo_url) {
        const oldPath = path.join(process.cwd(), 'public', existing.logo_url);
        fs.unlink(oldPath, () => {});
      }
      finalLogo = toUrlPath(req.file.filename);
    }

    db.run(
      `UPDATE ngo_info
       SET name = ?, about = ?, work = ?, projects = ?, events = ?, profile = ?, logo_url = ?, contact_email = ?, contact_phone = ?, address = ?, website = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name || existing.name,
        about || null,
        work || null,
        projects || null,
        events || null,
        profile || null,
        finalLogo,
        contact_email || null,
        contact_phone || null,
        address || null,
        website || null,
        req.params.id
      ],
      (err) => {
        if (err) {
          if (req.file) fs.unlink(req.file.path, () => {});
          return res.status(500).json({ success: false, message: 'Error updating NGO', error: err.message });
        }
        res.json({ success: true, message: 'NGO updated' });
      }
    );
  });
});

// Delete NGO
router.delete('/:id', authenticateToken, requireRole('admin', 'office_bearer'), (req, res) => {
  const db = getDatabase();

  db.get('SELECT * FROM ngo_info WHERE id = ?', [req.params.id], (findErr, existing) => {
    if (findErr) return res.status(500).json({ success: false, message: 'Database error', error: findErr.message });
    if (!existing) return res.status(404).json({ success: false, message: 'NGO not found' });

    if (existing.logo_url) {
      const oldPath = path.join(process.cwd(), 'public', existing.logo_url);
      fs.unlink(oldPath, () => {});
    }

    db.run('DELETE FROM ngo_info WHERE id = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error deleting NGO', error: err.message });
      res.json({ success: true, message: 'NGO deleted' });
    });
  });
});

export default router;
