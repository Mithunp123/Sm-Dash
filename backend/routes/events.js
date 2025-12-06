import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET all events with OD status for a student (if provided)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { year, month } = req.query; // Optional filter by year and month

    let query = 'SELECT * FROM events ORDER BY date DESC';
    let params = [];

    if (year && month) {
      // SQLite: extract month with strftime('%m', date) which returns '01'..'12'
      const monthPadded = String(month).padStart(2, '0');
      query = 'SELECT * FROM events WHERE year = ? AND strftime("%m", date) = ? ORDER BY date DESC';
      params = [year, monthPadded];
    } else if (year) {
      query = 'SELECT * FROM events WHERE year = ? ORDER BY date DESC';
      params = [year];
    } else if (month) {
      const monthPadded = String(month).padStart(2, '0');
      query = 'SELECT * FROM events WHERE strftime("%m", date) = ? ORDER BY date DESC';
      params = [monthPadded];
    }
    
    db.all(query, params, (err, events) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      }

      // If user is student, get their OD status for each event
      if (req.user.role === 'student') {
        db.all(
          'SELECT event_id, status FROM event_od WHERE user_id = ?',
          [req.user.id],
          (err, odRecords) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Database error', error: err.message });
            }

            const odMap = {};
            odRecords.forEach(record => {
              odMap[record.event_id] = record.status;
            });

            events.forEach(e => {
              e.student_status = odMap[e.id] || null;
            });

            res.json({ success: true, events });
          }
        );
      } else {
        res.json({ success: true, events });
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching events', error: error.message });
  }
});

// GET events for a user (by membership)
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { userId } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    // Allow user to see their own events, admin can see anyone's
    if (requesterRole !== 'admin' && requesterId !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    db.all(`
      SELECT e.* FROM events e
      JOIN event_members em ON em.event_id = e.id
      WHERE em.user_id = ?
      ORDER BY e.date DESC
    `, [userId], (err, events) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Server error', error: err.message });
      }
      res.json({ success: true, events: events || [] });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET OD history for a student (student can see their own, admin can see any)
// MUST come before generic /:id route
router.get('/student-od/:userId', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { userId } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    // Allow student to see their own OD, admin can see anyone's
    if (requesterRole !== 'admin' && requesterId !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Cannot view other student OD history' });
    }

    db.all(
      `SELECT e.id as event_id, e.title, e.date, eo.status
       FROM event_od eo
       JOIN events e ON eo.event_id = e.id
       WHERE eo.user_id = ?
       ORDER BY e.date DESC`,
      [userId],
      (err, records) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }

        // Calculate counts
        const odCount = records.filter(r => r.status === 'od').length;
        const absentCount = records.filter(r => r.status === 'absent').length;
        const permissionCount = records.filter(r => r.status === 'permission').length;

        res.json({
          success: true,
          odCount,
          absentCount,
          permissionCount,
          totalMarked: records.length,
          records
        });
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching OD history', error: error.message });
  }
});

// Event members management (admin only) - MUST come before generic /:id route
router.get('/:id/members', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    db.all(
      `SELECT em.id, em.event_id, em.user_id, u.name as user_name, u.email as user_email, em.joined_at
       FROM event_members em
       JOIN users u ON em.user_id = u.id
       WHERE em.event_id = ?
       ORDER BY u.name`,
      [id],
      (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        res.json({ success: true, members: rows });
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching members', error: error.message });
  }
});

router.post('/:id/members', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'userIds array required' });
    }
    const placeholders = userIds.map(() => '(?, ?)').join(',');
    const params = [];
    userIds.forEach((uid) => { params.push(id, uid); });
    const sql = `INSERT OR IGNORE INTO event_members (event_id, user_id) VALUES ${placeholders}`;
    db.run(sql, params, function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      res.json({ success: true, added: this.changes });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding members', error: error.message });
  }
});

router.post('/:id/members/by-email', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, message: 'emails array required' });
    }

    const normalized = emails
      .filter(email => typeof email === 'string' && email.trim() !== '')
      .map(email => email.trim().toLowerCase());

    if (normalized.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid emails provided' });
    }

    const placeholders = normalized.map(() => '?').join(',');
    db.all(`SELECT id, email FROM users WHERE lower(email) IN (${placeholders})`, normalized, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, message: 'No matching users found for provided emails' });
      }

      const userIds = rows.map(row => row.id);
      const insertPlaceholders = userIds.map(() => '(?, ?)').join(',');
      const params = [];
      userIds.forEach((uid) => { params.push(id, uid); });
      const sql = `INSERT OR IGNORE INTO event_members (event_id, user_id) VALUES ${insertPlaceholders}`;
      db.run(sql, params, function(insertErr) {
        if (insertErr) {
          return res.status(500).json({ success: false, message: 'Database error', error: insertErr.message });
        }
        const addedEmails = rows.map(row => row.email);
        const missingEmails = normalized.filter(email => !addedEmails.includes(email));
        res.json({
          success: true,
          added: this.changes,
          matchedEmails: addedEmails,
          missingEmails
        });
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding members by email', error: error.message });
  }
});

router.delete('/:id/members/:userId', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDatabase();
    const { id, userId } = req.params;
    db.run('DELETE FROM event_members WHERE event_id = ? AND user_id = ?', [id, userId], function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      if (this.changes === 0) return res.status(404).json({ success: false, message: 'Member not found' });
      res.json({ success: true, message: 'Member removed' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error removing member', error: error.message });
  }
});

// MARK OD for a student (admin only)
// MUST come before generic /:id route
router.post('/:eventId/od', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDatabase();
    const { eventId } = req.params;
    const { userId, status } = req.body; // status: 'od' or 'absent' or 'permission'

    if (!userId || !status || !['od', 'absent', 'permission'].includes(status)) {
      return res.status(400).json({ success: false, message: "userId and status (od/absent/permission) are required" });
    }

    // Check if record exists
    db.get('SELECT id FROM event_od WHERE event_id = ? AND user_id = ?', [eventId, userId], (err, existing) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      }

      if (existing) {
        // Update existing record
        db.run(
          'UPDATE event_od SET status = ? WHERE event_id = ? AND user_id = ?',
          [status, eventId, userId],
          function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to update OD', error: err.message });
            }
            res.json({ success: true, message: 'OD status updated successfully' });
          }
        );
      } else {
        // Insert new record
        db.run(
          'INSERT INTO event_od (event_id, user_id, status) VALUES (?, ?, ?)',
          [eventId, userId, status],
          function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to mark OD', error: err.message });
            }
            res.json({ success: true, message: 'OD marked successfully' });
          }
        );
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error marking OD', error: error.message });
  }
});

// REMOVE OD record (admin only)
// MUST come before generic /:id route
router.delete('/:eventId/od/:userId', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDatabase();
    const { eventId, userId } = req.params;

    db.run('DELETE FROM event_od WHERE event_id = ? AND user_id = ?', [eventId, userId], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to remove OD', error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'OD record not found' });
      }
      res.json({ success: true, message: 'OD record removed successfully' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error removing OD', error: error.message });
  }
});

// GET single event with OD details - GENERIC ROUTE (comes after specific routes)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    db.get('SELECT * FROM events WHERE id = ?', [id], (err, event) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      }
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }

      // Get OD records for this event
      db.all(
        `SELECT e.id as event_od_id, e.user_id, e.status, u.name, u.email
         FROM event_od e
         JOIN users u ON e.user_id = u.id
         WHERE e.event_id = ?
         ORDER BY u.name`,
        [id],
        (err, odRecords) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
          }
          res.json({ success: true, event, odRecords });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching event', error: error.message });
  }
});

// CREATE event (admin only)
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDatabase();
    const { title, description, date, year, is_special_day } = req.body;

    if (!title || !date || !year) {
      return res.status(400).json({ success: false, message: 'Title, date, and year are required' });
    }

    db.run(
      `INSERT INTO events (title, description, date, year, is_special_day, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [title, description || null, date, year, is_special_day ? 1 : 0],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Failed to create event', error: err.message });
        }
        res.json({ success: true, id: this.lastID, message: 'Event created successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating event', error: error.message });
  }
});

// UPDATE event (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { title, description, date, year, is_special_day } = req.body;

    db.run(
      `UPDATE events SET title = ?, description = ?, date = ?, year = ?, is_special_day = ?
       WHERE id = ?`,
      [title, description, date, year, is_special_day ? 1 : 0, id],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Failed to update event', error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ success: false, message: 'Event not found' });
        }
        res.json({ success: true, message: 'Event updated successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating event', error: error.message });
  }
});

// DELETE event (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    db.run('DELETE FROM events WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete event', error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      // Also delete OD records for this event
      db.run('DELETE FROM event_od WHERE event_id = ?', [id], (err) => {
        if (err) {
          console.error('Error deleting OD records:', err);
        }
      });
      res.json({ success: true, message: 'Event deleted successfully' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting event', error: error.message });
  }
});

export default router;
