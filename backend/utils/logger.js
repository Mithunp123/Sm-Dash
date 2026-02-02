
import { getDatabase } from '../database/init.js';

const run = (db, query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

/**
 * Log a user activity to the database
 * @param {number|null} userId - The ID of the user performing the action
 * @param {string} action - Descriptive name of the action (e.g., 'LOGIN', 'UPDATE_PROFILE')
 * @param {string|object} details - Additional information about the action
 * @param {object} req - Express request object (optional, used for IP and user-agent)
 */
export const logActivity = async (userId, action, details, req = null) => {
    try {
        const db = getDatabase();
        const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;
        const ipAddress = req ? (req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress) : null;
        const userAgent = req ? req.headers['user-agent'] : null;

        await run(db,
            'INSERT INTO activity_logs (user_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
            [userId, action, detailsStr, ipAddress, userAgent]
        );
        console.log(`📝 Activity Logged: ${action} by user ${userId || 'System'}`);
    } catch (error) {
        console.error('❌ Failed to log activity:', error);
    }
};
