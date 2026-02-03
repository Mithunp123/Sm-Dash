import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';


const router = express.Router();

// Helper to run database queries
const run = (db, query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
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

const get = (db, query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// GET all announcements (ordered by newest)
// Used by landing page ticker and admin history
router.get('/', async (req, res) => {
    const db = getDatabase();
    try {
        const announcements = await all(db, 'SELECT * FROM announcements WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 20');
        res.json({ success: true, announcements });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// CREATE announcement
router.post('/', authenticateToken, async (req, res) => {
    const { title, content, priority, linkUrl, imageUrl, deadline } = req.body;
    const db = getDatabase();
    const userId = req.user.id;

    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    try {
        const result = await run(db,
            'INSERT INTO announcements (title, content, priority, created_by, link_url, image_url, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, content, priority || 'normal', userId, linkUrl || null, imageUrl || null, deadline || null]
        );

        await logActivity(userId, 'CREATE_ANNOUNCEMENT', { title }, req, {
            action_type: 'CREATE',
            module_name: 'announcements',
            action_description: `Created announcement: ${title}`,
            reference_id: result.lastID
        });

        res.json({ success: true, message: 'Announcement created successfully', id: result.lastID });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE announcement (Soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();
    try {
        await run(db, 'UPDATE announcements SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

        await logActivity(req.user.id, 'DELETE_ANNOUNCEMENT', { id }, req, {
            action_type: 'DELETE',
            module_name: 'announcements',
            action_description: `Deleted announcement ID: ${id}`,
            reference_id: id
        });

        res.json({ success: true, message: 'Announcement deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
