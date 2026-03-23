import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, allowFinance, requireAdmin } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';

const router = express.Router();

// Helper wrappers (use db.run/db.get/db.all that initDatabase attaches)
const run = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
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

const all = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const normalizeNumber = (v) => {
  if (v === '' || v === undefined || v === null) return 0;
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

const validateFolderAdd = (body) => {
  const { event_id, folder_name, description } = body || {};
  if (!event_id || !folder_name) {
    return { ok: false, message: 'folder_name and event_id are required' };
  }
  const name = String(folder_name).trim();
  if (name.length < 2) {
    return { ok: false, message: 'folder_name must be at least 2 characters' };
  }
  return {
    ok: true,
    data: {
      event_id,
      folder_name: name,
      description: description ? String(description) : ''
    }
  };
};

const validateExpenseAdd = (body) => {
  const {
    event_id,
    folder_id,
    expense_title,
    category,
    transport_from,
    transport_to,
    transport_mode,
    fuel_amount,
    breakfast_amount,
    lunch_amount,
    dinner_amount,
    refreshment_amount,
    accommodation_amount,
    other_expense
  } = body || {};

  if (!event_id || !folder_id || !expense_title) {
    return { ok: false, message: 'Missing required fields: event_id, folder_id, expense_title' };
  }

  const validCategories = ['fuel', 'food', 'travel', 'accommodation', 'other'];
  const cat = category ? String(category) : 'other';
  if (cat && !validCategories.includes(cat)) {
    return { ok: false, message: `category must be one of: ${validCategories.join(', ')}` };
  }

  const amountFields = [
    fuel_amount,
    breakfast_amount,
    lunch_amount,
    dinner_amount,
    refreshment_amount,
    accommodation_amount,
    other_expense
  ];
  // Disallow negative values
  for (const v of amountFields) {
    if (v === '' || v === undefined || v === null) continue;
    const n = parseFloat(v);
    if (Number.isNaN(n) || n < 0) {
      return { ok: false, message: 'Expense amounts must be non-negative numbers' };
    }
  }

  return {
    ok: true,
    data: {
      event_id,
      folder_id,
      expense_title: String(expense_title).trim(),
      category: cat || 'other',
      transport_from: transport_from ? String(transport_from) : null,
      transport_to: transport_to ? String(transport_to) : null,
      transport_mode: transport_mode ? String(transport_mode) : null,
      fuel_amount: normalizeNumber(fuel_amount),
      breakfast_amount: normalizeNumber(breakfast_amount),
      lunch_amount: normalizeNumber(lunch_amount),
      dinner_amount: normalizeNumber(dinner_amount),
      refreshment_amount: normalizeNumber(refreshment_amount),
      accommodation_amount: normalizeNumber(accommodation_amount),
      other_expense: normalizeNumber(other_expense)
    }
  };
};

/**
 * POST /expenses/folder/add
 * Create a new bill folder
 */
router.post('/folder/add', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const validated = validateFolderAdd(req.body);
    if (!validated.ok) {
      return res.status(400).json({ success: false, message: validated.message });
    }

    const result = await run(
      db,
      `
      INSERT INTO bill_folders (event_id, folder_name, description, created_by)
      VALUES (?, ?, ?, ?)
      `,
      [
        validated.data.event_id,
        validated.data.folder_name,
        validated.data.description,
        req.user.id
      ]
    );

    res.json({
      success: true,
      message: 'Folder created successfully',
      id: result.lastID
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /expenses/folders/:eventId
 * Get all folders for an event
 */
router.get('/folders/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { eventId } = req.params;

    const folders = await all(
      db,
      `
      SELECT
        bf.*,
        u.name as created_by_name,
        COUNT(e.id) as expense_count,
        COALESCE(SUM(e.grand_total), 0) as folder_total
      FROM bill_folders bf
      LEFT JOIN users u ON bf.created_by = u.id
      LEFT JOIN expenses e ON bf.id = e.folder_id
      WHERE bf.event_id = ?
      GROUP BY bf.id
      ORDER BY bf.created_at DESC
      `,
      [eventId]
    );

    res.json({
      success: true,
      folders,
      count: folders.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /expenses/folder/:folderId
 * Get folder with all expenses
 */
router.get('/folder/:folderId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { folderId } = req.params;

    const folder = await get(
      db,
      `
      SELECT
        bf.*,
        u.name as created_by_name
      FROM bill_folders bf
      LEFT JOIN users u ON bf.created_by = u.id
      WHERE bf.id = ?
      `,
      [folderId]
    );

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    const expenses = await all(
      db,
      `
      SELECT
        e.*,
        u2.name as created_by_name
      FROM expenses e
      LEFT JOIN users u2 ON e.created_by = u2.id
      WHERE e.folder_id = ?
      ORDER BY e.created_at DESC
      `,
      [folderId]
    );

    const folder_total = expenses.reduce((sum, e) => sum + (e.grand_total || 0), 0);

    res.json({
      success: true,
      folder: {
        ...folder,
        expenses,
        expense_count: expenses.length,
        folder_total
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /expenses/add
 * Add a new expense
 */
router.post('/add', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const validated = validateExpenseAdd(req.body);
    if (!validated.ok) {
      return res.status(400).json({ success: false, message: validated.message });
    }

    // Verify folder belongs to event (prevents cross-event injection)
    const folderValid = await get(
      db,
      'SELECT id FROM bill_folders WHERE id = ? AND event_id = ?',
      [validated.data.folder_id, validated.data.event_id]
    );

    if (!folderValid) {
      return res.status(400).json({
        success: false,
        message: 'Folder does not belong to this event'
      });
    }

    const result = await run(
      db,
      `
      INSERT INTO expenses (
        event_id, folder_id, expense_title, category,
        transport_from, transport_to, transport_mode,
        fuel_amount, breakfast_amount, lunch_amount, dinner_amount, refreshment_amount,
        accommodation_amount, other_expense,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        validated.data.event_id,
        validated.data.folder_id,
        validated.data.expense_title,
        validated.data.category,
        validated.data.transport_from,
        validated.data.transport_to,
        validated.data.transport_mode,
        validated.data.fuel_amount,
        validated.data.breakfast_amount,
        validated.data.lunch_amount,
        validated.data.dinner_amount,
        validated.data.refreshment_amount,
        validated.data.accommodation_amount,
        validated.data.other_expense,
        req.user.id
      ]
    );

    await logActivity(req.user.id, 'ADD_EXPENSE', { event_id: validated.data.event_id, folder_id: validated.data.folder_id, expense_title: validated.data.expense_title }, req, {
      action_type: 'CREATE',
      module_name: 'expenses',
      action_description: `Added expense: ${validated.data.expense_title}`,
      reference_id: result.lastID
    });

    res.json({
      success: true,
      message: 'Expense added successfully',
      id: result.lastID
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /expenses/list/:eventId
 * Get all expenses for an event
 */
router.get('/list/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { eventId } = req.params;

    const expenses = await all(
      db,
      `
      SELECT
        e.*,
        bf.folder_name,
        u.name as created_by_name
      FROM expenses e
      LEFT JOIN bill_folders bf ON e.folder_id = bf.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.event_id = ?
      ORDER BY e.created_at DESC
      `,
      [eventId]
    );

    res.json({
      success: true,
      expenses,
      count: expenses.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /expenses/:id
 * Update an expense (Office Bearer can only update their own)
 */
router.put('/:id', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const validated = validateExpenseAdd(req.body);
    if (!validated.ok) {
      return res.status(400).json({ success: false, message: validated.message });
    }

    const ownershipWhere = req.user.role === 'office_bearer' ? 'AND created_by = ?' : '';
    const ownershipParams = req.user.role === 'office_bearer' ? [req.user.id] : [];

    const result = await run(
      db,
      `
      UPDATE expenses
      SET
        expense_title = ?,
        category = ?,
        transport_from = ?,
        transport_to = ?,
        transport_mode = ?,
        fuel_amount = ?,
        breakfast_amount = ?,
        lunch_amount = ?,
        dinner_amount = ?,
        refreshment_amount = ?,
        accommodation_amount = ?,
        other_expense = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      ${ownershipWhere}
      `,
      [
        validated.data.expense_title,
        validated.data.category,
        validated.data.transport_from,
        validated.data.transport_to,
        validated.data.transport_mode,
        validated.data.fuel_amount,
        validated.data.breakfast_amount,
        validated.data.lunch_amount,
        validated.data.dinner_amount,
        validated.data.refreshment_amount,
        validated.data.accommodation_amount,
        validated.data.other_expense,
        id,
        ...ownershipParams
      ]
    );

    res.json({
      success: true,
      message: 'Expense updated successfully',
      affectedRows: result.changes
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /expenses/:id
 * Delete an expense (Admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const result = await run(db, 'DELETE FROM expenses WHERE id = ?', [id]);

    await logActivity(req.user.id, 'DELETE_EXPENSE', { id }, req, {
      action_type: 'DELETE',
      module_name: 'expenses',
      action_description: `Deleted expense id=${id}`,
      reference_id: id
    });

    res.json({
      success: true,
      message: 'Expense deleted successfully',
      affectedRows: result.changes
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
