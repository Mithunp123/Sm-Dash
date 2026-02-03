
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
 * @param {number|null} userId - The ID of the user performing the action (legacy)
 * @param {string} action - Descriptive name of the action (e.g., 'LOGIN', 'UPDATE_PROFILE')
 * @param {string|object} details - Additional information about the action
 * @param {object} req - Express request object (optional, used for IP, user-agent, and actor context)
 * @param {object} extra - Extra fields (action_type, module_name, action_description, reference_id)
 */
export const logActivity = async (userId, action, details, req = null, extra = {}) => {
    try {
        const db = getDatabase();
        const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;
        const ipAddress = req ? (req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress) : null;
        const userAgent = req ? req.headers['user-agent'] : null;

        // Extract actor info from request if available
        const actorId = req?.user?.id || userId || null;
        const actorRole = req?.user?.role || null;

        // Structured fields from extra
        const {
            action_type = null,
            module_name = null,
            action_description = null,
            reference_id = null
        } = extra;

        const query = `
            INSERT INTO activity_logs 
            (user_id, actor_id, actor_role, action_type, module_name, action, action_description, details, reference_id, ip_address, user_agent) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await run(db, query, [
            actorId,
            actorId,
            actorRole,
            action_type,
            module_name,
            action,
            action_description || action,
            detailsStr,
            reference_id ? String(reference_id) : null,
            ipAddress,
            userAgent
        ]);
        console.log(`📝 Activity Logged: ${action} by ${actorRole || 'System'} ${actorId || 'System'}`);
    } catch (error) {
        console.error('❌ Failed to log activity:', error);
    }
};
