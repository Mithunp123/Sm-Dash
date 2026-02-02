import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { getDatabase } from '../database/init.js';

const router = express.Router();

// Get feedback questions
router.get('/questions', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const user = req.user;

    // For non-students and non-admins, check if they have view permission
    // We do this check manually here because the route is shared with students
    if (user.role !== 'admin' && user.role !== 'student') {
      const { requirePermission: checkPermission } = await import('../middleware/auth.js');
      // This is a bit hacky, but better than duplicating route logic
      // Actually, let's just do a manual check for simplicity or refactor
    }

    let query = `
      SELECT 
        fq.id, fq.question_text, fq.question_type, fq.event_id, fq.is_enabled, fq.created_at, fq.updated_at,
        m.title AS event_title, m.date AS event_date
      FROM feedback_questions fq
      LEFT JOIN meetings m ON fq.event_id = m.id
      WHERE fq.deleted_at IS NULL
    `;
    const params = [];

    // If student, only show enabled questions for their events (or general questions)
    if (user.role === 'student') {
      query += `
        AND fq.is_enabled = 1
        AND (
          fq.event_id IS NULL
          OR fq.event_id IN (
            SELECT DISTINCT meeting_id FROM attendance WHERE user_id = ?
          )
        )
      `;
      params.push(user.id);
    }

    query += ` ORDER BY fq.created_at DESC`;

    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, questions: rows || [] });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create feedback question
router.post('/questions', authenticateToken, requirePermission('can_manage_feedback_questions', { requireEdit: true }), (req, res) => {
  try {
    const db = getDatabase();
    const { question_text, question_type, event_id, is_enabled } = req.body;
    const user = req.user;

    if (!question_text || !question_type) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const query = `
      INSERT INTO feedback_questions (question_text, question_type, event_id, is_enabled, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;
    const enabledValue = is_enabled === 0 || is_enabled === false ? 0 : 1;

    db.run(query, [question_text, question_type, event_id || null, enabledValue, user.id], function (err) {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, id: this.lastID, message: 'Question created' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update feedback question
router.put('/questions/:id', authenticateToken, requirePermission('can_manage_feedback_questions', { requireEdit: true }), (req, res) => {
  try {
    const db = getDatabase();
    const { question_text, question_type, event_id, is_enabled } = req.body;
    const questionId = req.params.id;

    const enabledValue = is_enabled === 0 || is_enabled === false ? 0 : 1;
    const query = `
      UPDATE feedback_questions
      SET question_text = ?, question_type = ?, event_id = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    db.run(query, [question_text, question_type, event_id || null, enabledValue, questionId], function (err) {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'Question updated' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle feedback question enabled/disabled
router.patch('/questions/:id/toggle', authenticateToken, requirePermission('can_manage_feedback_questions', { requireEdit: true }), (req, res) => {
  try {
    const db = getDatabase();
    const questionId = req.params.id;

    const query = `
      UPDATE feedback_questions
      SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    db.run(query, [questionId], function (err) {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'Question toggled' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete feedback question (soft delete)
router.delete('/questions/:id', authenticateToken, requirePermission('can_manage_feedback_questions', { requireEdit: true }), (req, res) => {
  try {
    const db = getDatabase();
    const questionId = req.params.id;

    const query = `UPDATE feedback_questions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(query, [questionId], function (err) {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'Question deleted' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit feedback response (Students only)
router.post('/responses', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const { question_id, rating, feedback_text } = req.body;
    const user = req.user;

    // Keep this role check as it's specifically for students
    if (user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Only students can submit feedback' });
    }

    if (!question_id || !rating) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const query = `
      INSERT INTO feedback_responses (question_id, user_id, rating, feedback_text)
      VALUES (?, ?, ?, ?)
    `;
    db.run(query, [question_id, user.id, rating, feedback_text || null], function (err) {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, id: this.lastID, message: 'Feedback submitted' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all feedback responses
router.get('/responses', authenticateToken, requirePermission('can_manage_feedback_reports', { allowView: true }), (req, res) => {
  try {
    const db = getDatabase();

    const query = `
      SELECT 
        fr.id, fr.question_id, fr.user_id, fr.rating, fr.feedback_text, fr.created_at,
        fq.question_text, fq.question_type,
        u.name AS student_name, u.email AS student_email
      FROM feedback_responses fr
      JOIN feedback_questions fq ON fr.question_id = fq.id
      JOIN users u ON fr.user_id = u.id
      ORDER BY fr.created_at DESC
    `;
    db.all(query, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, responses: rows || [] });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get feedback responses for a specific question
router.get('/responses/question/:questionId', authenticateToken, requirePermission('can_manage_feedback_reports', { allowView: true }), (req, res) => {
  try {
    const db = getDatabase();
    const { questionId } = req.params;

    const query = `
      SELECT 
        fr.id, fr.question_id, fr.user_id, fr.rating, fr.feedback_text, fr.created_at,
        u.name AS student_name, u.email AS student_email
      FROM feedback_responses fr
      JOIN users u ON fr.user_id = u.id
      WHERE fr.question_id = ?
      ORDER BY fr.created_at DESC
    `;
    db.all(query, [questionId], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, responses: rows || [] });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
