import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getDatabase } from '../database/init.js';

const router = express.Router();

const obDir = path.join(process.cwd(), 'public', 'uploads', 'office-bearers');
if (!fs.existsSync(obDir)) {
    fs.mkdirSync(obDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, obDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `ob-${unique}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });
const toUrlPath = (filename) => (filename ? `/uploads/office-bearers/${filename}` : null);

// Public list
router.get('/public', (req, res) => {
    const db = getDatabase();
    db.all('SELECT * FROM office_bearers ORDER BY academic_year DESC, position ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        res.json({ success: true, officeBearers: rows || [] });
    });
});

// Authenticated list
router.get('/', authenticateToken, (req, res) => {
    const db = getDatabase();
    db.all('SELECT * FROM office_bearers ORDER BY academic_year DESC, position ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        res.json({ success: true, officeBearers: rows || [] });
    });
});

// Create
router.post('/', authenticateToken, requireRole('admin', 'office_bearer'), upload.single('photo'), (req, res) => {
    const db = getDatabase();
    const { name, position, contact, email, academic_year } = req.body;
    const photoUrl = req.file ? toUrlPath(req.file.filename) : null;

    if (!name || !position) {
        if (req.file) fs.unlink(req.file.path, () => { });
        return res.status(400).json({ success: false, message: 'Name and Position are required' });
    }

    db.run(
        `INSERT INTO office_bearers (name, position, contact, email, photo_url, academic_year)
     VALUES (?, ?, ?, ?, ?, ?)`,
        [name, position, contact || null, email || null, photoUrl, academic_year || null],
        function (err) {
            if (err) {
                if (req.file) fs.unlink(req.file.path, () => { });
                return res.status(500).json({ success: false, message: 'Error creating office bearer', error: err.message });
            }
            res.json({ success: true, message: 'Office bearer created', id: this.lastID });
        }
    );
});

// Update
router.put('/:id', authenticateToken, requireRole('admin', 'office_bearer'), upload.single('photo'), (req, res) => {
    const db = getDatabase();
    const { name, position, contact, email, academic_year } = req.body;

    db.get('SELECT * FROM office_bearers WHERE id = ?', [req.params.id], (findErr, existing) => {
        if (findErr) {
            if (req.file) fs.unlink(req.file.path, () => { });
            return res.status(500).json({ success: false, message: 'Database error', error: findErr.message });
        }
        if (!existing) {
            if (req.file) fs.unlink(req.file.path, () => { });
            return res.status(404).json({ success: false, message: 'Office bearer not found' });
        }

        let finalPhoto = existing.photo_url;
        if (req.file) {
            if (existing.photo_url) {
                const oldPath = path.join(process.cwd(), 'public', existing.photo_url);
                if (fs.existsSync(oldPath)) {
                    fs.unlink(oldPath, (err) => {
                        if (err) console.error("Error deleting old OB photo:", err);
                    });
                }
            }
            finalPhoto = toUrlPath(req.file.filename);
        }

        db.run(
            `UPDATE office_bearers
       SET name = ?, position = ?, contact = ?, email = ?, photo_url = ?, academic_year = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
            [
                name || existing.name,
                position || existing.position,
                contact || null,
                email || null,
                finalPhoto,
                academic_year || existing.academic_year,
                req.params.id
            ],
            (err) => {
                if (err) {
                    if (req.file) fs.unlink(req.file.path, () => { });
                    return res.status(500).json({ success: false, message: 'Error updating office bearer', error: err.message });
                }
                res.json({ success: true, message: 'Office bearer updated' });
            }
        );
    });
});

// Delete
router.delete('/:id', authenticateToken, requireRole('admin', 'office_bearer'), (req, res) => {
    const db = getDatabase();
    db.get('SELECT * FROM office_bearers WHERE id = ?', [req.params.id], (findErr, existing) => {
        if (findErr) return res.status(500).json({ success: false, message: 'Database error', error: findErr.message });
        if (!existing) return res.status(404).json({ success: false, message: 'Office bearer not found' });

        if (existing.photo_url) {
            const oldPath = path.join(process.cwd(), 'public', existing.photo_url);
            if (fs.existsSync(oldPath)) {
                fs.unlink(oldPath, () => { });
            }
        }

        db.run('DELETE FROM office_bearers WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Error deleting office bearer', error: err.message });
            res.json({ success: true, message: 'Office bearer deleted' });
        });
    });
});

export default router;
