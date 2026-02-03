import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

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

// Get activity logs (Admin / Office Bearer only)
router.get('/', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    try {
        const {
            userId,
            role,
            module,
            actionType,
            limit = 100,
            offset = 0
        } = req.query;

        const db = getDatabase();

        let query = `
      SELECT al.*, u.name as actor_name, u.email as actor_email
      FROM activity_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      WHERE 1=1
    `;
        const params = [];

        if (userId) {
            query += ` AND al.actor_id = ?`;
            params.push(userId);
        }

        if (role) {
            query += ` AND al.actor_role = ?`;
            params.push(role);
        }

        if (module) {
            query += ` AND al.module_name = ?`;
            params.push(module);
        }

        if (actionType) {
            query += ` AND al.action_type = ?`;
            params.push(actionType);
        }

        query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const logs = await all(db, query, params);

        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get summary stats for dashboard
router.get('/stats', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    try {
        const db = getDatabase();

        const stats = await get(db, `
      SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT actor_id) as active_users,
        SUM(CASE WHEN action_type = 'LOGIN' THEN 1 ELSE 0 END) as total_logins
      FROM activity_logs
      WHERE created_at > DATE('now', '-30 days')
    `);

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Get activity stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
