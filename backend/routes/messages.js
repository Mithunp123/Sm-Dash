
import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to wrap db calls
const all = (db, query, params) => {
    if (process.env.DB_TYPE === 'mysql') return db.all(query, params);
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const get = (db, query, params) => {
    if (process.env.DB_TYPE === 'mysql') return db.get(query, params);
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const run = (db, query, params) => {
    if (process.env.DB_TYPE === 'mysql') return db.run(query, params);
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

// Get all conversations for the current user
router.get('/conversations', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const userId = req.user.id;

        // This query gets the latest message for each contact the user has messaged
        const conversations = await all(db, `
      SELECT 
        u.id as contact_id,
        u.name as contact_name,
        u.email as contact_email,
        u.role as contact_role,
        p.photo_url as contact_photo,
        m.message as last_message,
        m.created_at as last_message_time,
        m.is_read,
        m.sender_id
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      JOIN chat_messages m ON (
        (m.sender_id = ? AND m.recipient_id = u.id) OR 
        (m.sender_id = u.id AND m.recipient_id = ?)
      )
      WHERE m.id IN (
        SELECT MAX(id)
        FROM chat_messages
        WHERE sender_id = ? OR recipient_id = ?
        GROUP BY CASE 
          WHEN sender_id = ? THEN recipient_id 
          ELSE sender_id 
        END
      )
      ORDER BY m.created_at DESC
    `, [userId, userId, userId, userId, userId]);

        res.json({ success: true, conversations });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get message history with a specific user
router.get('/history/:contactId', authenticateToken, async (req, res) => {
    try {
        const { contactId } = req.params;
        const userId = req.user.id;
        const db = getDatabase();

        const messages = await all(db, `
      SELECT m.*, 
             s.name as sender_name,
             r.name as recipient_name
      FROM chat_messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.recipient_id = r.id
      WHERE (m.sender_id = ? AND m.recipient_id = ?) 
         OR (m.sender_id = ? AND m.recipient_id = ?)
      ORDER BY m.created_at ASC
    `, [userId, contactId, contactId, userId]);

        // Mark as read
        await run(db, `
      UPDATE chat_messages 
      SET is_read = 1 
      WHERE recipient_id = ? AND sender_id = ? AND is_read = 0
    `, [userId, contactId]);

        res.json({ success: true, messages });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Send a message
router.post('/send', authenticateToken, async (req, res) => {
    try {
        const { recipientId, message, replyToId } = req.body;
        const senderId = req.user.id;
        const db = getDatabase();

        if (!recipientId || !message) {
            return res.status(400).json({ success: false, message: 'Recipient and message are required' });
        }

        const result = await run(db, `
      INSERT INTO chat_messages (sender_id, recipient_id, message, reply_to_id)
      VALUES (?, ?, ?, ?)
    `, [senderId, recipientId, message, replyToId || null]);

        const newMessage = await get(db, 'SELECT * FROM chat_messages WHERE id = ?', [result.lastID]);

        res.json({ success: true, message: 'Message sent', chatMessage: newMessage });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete a message (only if sender)
router.delete('/:messageId', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;
        const db = getDatabase();

        const message = await get(db, 'SELECT sender_id FROM chat_messages WHERE id = ?', [messageId]);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        if (message.sender_id !== userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized to delete this message' });
        }

        await run(db, 'DELETE FROM chat_messages WHERE id = ?', [messageId]);
        res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
