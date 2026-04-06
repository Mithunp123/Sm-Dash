import express from 'express';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../database/init.js';
import { authenticateToken, allowFinance } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';
import PDFDocument from 'pdfkit';
import xlsx from 'xlsx';
import { numberToWords, formatCompactDate, formatDate } from '../utils/formatters.js';

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

const normalizeSQLDateTime = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  // If it's already YYYY-MM-DD from <input type="date">, let MySQL parse it.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 00:00:00`;

  // Otherwise try to parse to a MySQL-friendly DATETIME string.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

const normalizeExpenseCategory = (category) => {
  const c = (category ? String(category) : '').trim().toLowerCase();

  // New spec keys
  if (['food & refreshment', 'food_refreshment', 'food-and-refreshment', 'foodrefreshment', 'food'].includes(c)) return 'food';
  if (['travel'].includes(c)) return 'travel';
  if (['fuel'].includes(c)) return 'fuel';
  if (['stationary', 'stationery'].includes(c)) return 'stationary';

  // Backward-compatible old keys
  if (['accommodation'].includes(c)) return 'accommodation';
  if (['other', 'misc'].includes(c)) return 'other';

  // Default fallback
  return 'other';
};

const calculateTotals = (breakdown) => {
  const breakfast = normalizeNumber(breakdown.breakfast_amount);
  const lunch = normalizeNumber(breakdown.lunch_amount);
  const dinner = normalizeNumber(breakdown.dinner_amount);
  const refreshment = normalizeNumber(breakdown.refreshment_amount);

  const food_total = breakfast + lunch + dinner + refreshment;
  // Existing schema uses fuel_amount as the "travel" contribution.
  const travel_total = normalizeNumber(breakdown.fuel_amount);
  const accommodationAmount = normalizeNumber(breakdown.accommodation_amount);
  const otherExpense = normalizeNumber(breakdown.other_expense);

  const grand_total = food_total + travel_total + accommodationAmount + otherExpense;
  return { food_total, travel_total, grand_total };
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
    // New spec inputs
    amount,
    date,
    from_location,
    to_location,
    // Backward-compatible inputs
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

  const cat = normalizeExpenseCategory(category);
  const created_at = normalizeSQLDateTime(date);

  const hasNewAmountPayload = amount !== undefined && amount !== null && String(amount).trim() !== '';

  if (hasNewAmountPayload) {
    const amt = normalizeNumber(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return { ok: false, message: 'amount must be greater than 0' };
    }

    const transportFrom = from_location ?? transport_from;
    const transportTo = to_location ?? transport_to;
    const transportMode = transport_mode ?? null;

    // Travel category: From/To are required by spec.
    if (cat === 'travel') {
      if (!transportFrom || !transportTo) {
        return { ok: false, message: 'From location and To location are required for Travel expenses' };
      }
    }

    // Map spec categories into existing schema fields.
    const breakdown = {
      fuel_amount: 0,
      breakfast_amount: 0,
      lunch_amount: 0,
      dinner_amount: 0,
      refreshment_amount: 0,
      accommodation_amount: 0,
      other_expense: 0
    };

    if (cat === 'food') breakdown.breakfast_amount = amt;
    else if (cat === 'travel' || cat === 'fuel') breakdown.fuel_amount = amt;
    else if (cat === 'stationary') breakdown.other_expense = amt;
    else if (cat === 'accommodation') breakdown.accommodation_amount = amt;
    else breakdown.other_expense = amt;

    const totals = calculateTotals(breakdown);
    if (totals.grand_total <= 0) {
      return { ok: false, message: 'amount must be greater than 0' };
    }

    return {
      ok: true,
      data: {
        event_id,
        folder_id,
        expense_title: String(expense_title).trim(),
        category: cat,
        transport_from: transportFrom ? String(transportFrom) : null,
        transport_to: transportTo ? String(transportTo) : null,
        transport_mode: transportMode ? String(transportMode) : null,
        ...breakdown,
        created_at,
        ...totals
      }
    };
  }

  // Backward-compatible payload path (old schema inputs)
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
    if (Number.isNaN(n) || n <= 0) {
      // Backward-compatible payload: require at least one positive amount (no zeros)
      return { ok: false, message: 'Expense amounts must be greater than 0' };
    }
  }

  const breakdown = {
    fuel_amount: normalizeNumber(fuel_amount),
    breakfast_amount: normalizeNumber(breakfast_amount),
    lunch_amount: normalizeNumber(lunch_amount),
    dinner_amount: normalizeNumber(dinner_amount),
    refreshment_amount: normalizeNumber(refreshment_amount),
    accommodation_amount: normalizeNumber(accommodation_amount),
    other_expense: normalizeNumber(other_expense)
  };

  const totals = calculateTotals(breakdown);
  if (totals.grand_total <= 0) {
    return { ok: false, message: 'amount must be greater than 0' };
  }

  return {
    ok: true,
    data: {
      event_id,
      folder_id,
      expense_title: String(expense_title).trim(),
      category: cat,
      transport_from: transport_from ? String(transport_from) : null,
      transport_to: transport_to ? String(transport_to) : null,
      transport_mode: transport_mode ? String(transport_mode) : null,
      ...breakdown,
      created_at,
      ...totals
    }
  };
};

const validateExpenseUpdate = (body) => {
  const {
    expense_title,
    category,
    // New spec inputs
    amount,
    date,
    from_location,
    to_location,
    // Backward-compatible inputs
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

  if (!expense_title) {
    return { ok: false, message: 'expense_title is required' };
  }

  const cat = normalizeExpenseCategory(category);
  const created_at = normalizeSQLDateTime(date);
  const hasNewAmountPayload = amount !== undefined && amount !== null && String(amount).trim() !== '';

  if (hasNewAmountPayload) {
    const amt = normalizeNumber(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return { ok: false, message: 'amount must be greater than 0' };
    }

    const transportFrom = from_location ?? transport_from;
    const transportTo = to_location ?? transport_to;
    const transportMode = transport_mode ?? null;

    if (cat === 'travel') {
      if (!transportFrom || !transportTo) {
        return { ok: false, message: 'From location and To location are required for Travel expenses' };
      }
    }

    const breakdown = {
      fuel_amount: 0,
      breakfast_amount: 0,
      lunch_amount: 0,
      dinner_amount: 0,
      refreshment_amount: 0,
      accommodation_amount: 0,
      other_expense: 0
    };

    if (cat === 'food') breakdown.breakfast_amount = amt;
    else if (cat === 'travel' || cat === 'fuel') breakdown.fuel_amount = amt;
    else if (cat === 'stationary') breakdown.other_expense = amt;
    else if (cat === 'accommodation') breakdown.accommodation_amount = amt;
    else breakdown.other_expense = amt;

    const totals = calculateTotals(breakdown);
    if (totals.grand_total <= 0) {
      return { ok: false, message: 'amount must be greater than 0' };
    }

    return {
      ok: true,
      data: {
        expense_title: String(expense_title).trim(),
        category: cat,
        transport_from: transportFrom ? String(transportFrom) : null,
        transport_to: transportTo ? String(transportTo) : null,
        transport_mode: transportMode ? String(transportMode) : null,
        ...breakdown,
        created_at,
        ...totals
      }
    };
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

  for (const v of amountFields) {
    if (v === '' || v === undefined || v === null) continue;
    const n = parseFloat(v);
    if (Number.isNaN(n) || n <= 0) {
      return { ok: false, message: 'Expense amounts must be greater than 0' };
    }
  }

  const breakdown = {
    fuel_amount: normalizeNumber(fuel_amount),
    breakfast_amount: normalizeNumber(breakfast_amount),
    lunch_amount: normalizeNumber(lunch_amount),
    dinner_amount: normalizeNumber(dinner_amount),
    refreshment_amount: normalizeNumber(refreshment_amount),
    accommodation_amount: normalizeNumber(accommodation_amount),
    other_expense: normalizeNumber(other_expense)
  };
  const totals = calculateTotals(breakdown);
  if (totals.grand_total <= 0) {
    return { ok: false, message: 'amount must be greater than 0' };
  }

  return {
    ok: true,
    data: {
      expense_title: String(expense_title).trim(),
      category: cat,
      transport_from: transport_from ? String(transport_from) : null,
      transport_to: transport_to ? String(transport_to) : null,
      transport_mode: transport_mode ? String(transport_mode) : null,
      ...breakdown,
      created_at,
      ...totals
    }
  };
};

const validateFolderUpdate = (body) => {
  const { folder_name, description } = body || {};
  if (!folder_name) return { ok: false, message: 'folder_name is required' };
  const name = String(folder_name).trim();
  if (name.length < 2) return { ok: false, message: 'folder_name must be at least 2 characters' };
  return {
    ok: true,
    data: {
      folder_name: name,
      description: description ? String(description) : ''
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
 * PUT /expenses/folder/:folderId
 * Edit a folder (Admin & Office Bearer can edit their own)
 */
router.put('/folder/:folderId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { folderId } = req.params;
    const validated = validateFolderUpdate(req.body);
    if (!validated.ok) return res.status(400).json({ success: false, message: validated.message });

    const id = parseInt(folderId);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid folderId' });

    if (req.user.role === 'student') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    if (req.user.role === 'office_bearer') {
      const owned = await get(db, 'SELECT created_by FROM bill_folders WHERE id = ?', [id]);
      if (!owned) return res.status(404).json({ success: false, message: 'Folder not found' });
      if (owned.created_by !== req.user.id) return res.status(403).json({ success: false, message: 'You can only edit your own folders' });
    }

    const result = await run(
      db,
      `
        UPDATE bill_folders
        SET folder_name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [validated.data.folder_name, validated.data.description, id]
    );

    res.json({
      success: true,
      message: 'Folder updated successfully',
      affectedRows: result.changes
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /expenses/folder/:folderId
 * Delete a folder (Admin & Office Bearer can delete their own)
 */
router.delete('/folder/:folderId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { folderId } = req.params;
    const id = parseInt(folderId);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid folderId' });

    if (req.user.role === 'student') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const folder = await get(db, 'SELECT id, created_by FROM bill_folders WHERE id = ?', [id]);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    if (req.user.role === 'office_bearer' && folder.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only delete your own folders' });
    }

    // Clean up dependent data to avoid foreign key constraints
    await run(db, 'DELETE FROM fund_collections WHERE event_id = ?', [id]);
    await run(db, 'DELETE FROM expenses WHERE folder_id = ?', [id]);

    const result = await run(db, 'DELETE FROM bill_folders WHERE id = ?', [id]);

    await logActivity(req.user.id, 'DELETE_FOLDER', { id }, req, {
      action_type: 'DELETE',
      module_name: 'expenses',
      action_description: `Deleted folder id=${id}`,
      reference_id: id
    });

    res.json({
      success: true,
      message: 'Folder deleted successfully',
      affectedRows: result.changes
    });
  } catch (err) {
    if (err.message && err.message.includes('foreign key constraint')) {
      return res.status(409).json({ success: false, message: 'Folder cannot be deleted because it has linked records. Please remove related collections/expenses first.' });
    }
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
        created_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
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
        req.user.id,
        validated.data.created_at,
        validated.data.created_at
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

    const validated = validateExpenseUpdate(req.body);
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
        created_at = COALESCE(?, created_at),
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
        validated.data.created_at,
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
router.delete('/:id', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user.role !== 'office_bearer') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const ownershipWhere = req.user.role === 'office_bearer' ? 'AND created_by = ?' : '';
    const ownershipParams = req.user.role === 'office_bearer' ? [req.user.id] : [];

    const deleteQuery = `DELETE FROM expenses WHERE id = ? ${ownershipWhere}`;
    const result = await run(db, deleteQuery, [id, ...ownershipParams]);

    if (req.user.role === 'office_bearer' && result.changes === 0) {
      const exists = await get(db, 'SELECT id FROM expenses WHERE id = ?', [id]);
      if (!exists) return res.status(404).json({ success: false, message: 'Expense not found' });
      return res.status(403).json({ success: false, message: 'You can only delete your own expenses' });
    }

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

/**
 * GET /expenses/summary/:eventId
 * Totals: overall + per category + per folder (with category subtotals)
 */
router.get('/summary/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { eventId } = req.params;

    const computedAmountExpr = `
      COALESCE(NULLIF(e.grand_total, 0),
        COALESCE(e.breakfast_amount, 0) +
        COALESCE(e.lunch_amount, 0) +
        COALESCE(e.dinner_amount, 0) +
        COALESCE(e.refreshment_amount, 0) +
        COALESCE(e.accommodation_amount, 0) +
        COALESCE(e.fuel_amount, 0) +
        COALESCE(e.other_expense, 0)
      )
    `;

    const overall = await get(
      db,
      `SELECT COALESCE(SUM(${computedAmountExpr}), 0) as overall_total FROM expenses e WHERE e.event_id = ?`,
      [eventId]
    );

    const totalsByCategory = await all(
      db,
      `
        SELECT
          category,
          COALESCE(SUM(${computedAmountExpr}), 0) as total
        FROM expenses e
        WHERE e.event_id = ?
        GROUP BY category
      `,
      [eventId]
    );

    const totalsByFolder = await all(
      db,
      `
        SELECT
          bf.id as folder_id,
          bf.folder_name,
          COALESCE(SUM(${computedAmountExpr}), 0) as folder_total
        FROM bill_folders bf
        LEFT JOIN expenses e ON e.folder_id = bf.id
        WHERE bf.event_id = ?
        GROUP BY bf.id
        ORDER BY bf.created_at DESC
      `,
      [eventId]
    );

    const categoryTotalsByFolderRows = await all(
      db,
      `
        SELECT
          bf.id as folder_id,
          e.category,
          COALESCE(SUM(${computedAmountExpr}), 0) as total
        FROM bill_folders bf
        LEFT JOIN expenses e ON e.folder_id = bf.id
        WHERE bf.event_id = ?
        GROUP BY bf.id, e.category
      `,
      [eventId]
    );

    const categoryTotalsByFolder = {};
    for (const row of categoryTotalsByFolderRows) {
      if (!categoryTotalsByFolder[row.folder_id]) categoryTotalsByFolder[row.folder_id] = {};
      categoryTotalsByFolder[row.folder_id][row.category] = Number(row.total || 0);
    }

    res.json({
      success: true,
      summary: {
        overall_total_expenses: Number(overall?.overall_total || 0),
        totals_by_category: totalsByCategory.reduce((acc, r) => {
          acc[r.category] = Number(r.total || 0);
          return acc;
        }, {}),
        totals_by_folder: totalsByFolder.map((f) => ({
          folder_id: f.folder_id,
          folder_name: f.folder_name,
          folder_total: Number(f.folder_total || 0),
          category_totals: categoryTotalsByFolder[f.folder_id] || {}
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const getExportExpensesRows = async (db, eventId) => {
  return await all(
    db,
    `
      SELECT
        e.id,
        e.event_id,
        e.folder_id,
        bf.folder_name,
        e.expense_title,
        e.category,
        e.grand_total,
        e.breakfast_amount,
        e.lunch_amount,
        e.dinner_amount,
        e.refreshment_amount,
        e.fuel_amount,
        e.accommodation_amount,
        e.other_expense,
        e.created_at,
        e.created_by,
        u.name as created_by_name,
        e.transport_from,
        e.transport_to
      FROM expenses e
      LEFT JOIN bill_folders bf ON e.folder_id = bf.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.event_id = ?
      ORDER BY e.created_at DESC
    `,
    [eventId]
  );
};

/**
 * GET /expenses/export/pdf/:eventId
 * Server-side PDF export of all expense data with logos
 */
router.get('/export/pdf/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { eventId } = req.params;

    const rows = await getExportExpensesRows(db, eventId);
    const calcAmount = (r) =>
      Number(r.breakfast_amount || 0) +
      Number(r.lunch_amount || 0) +
      Number(r.dinner_amount || 0) +
      Number(r.refreshment_amount || 0) +
      Number(r.accommodation_amount || 0) +
      Number(r.fuel_amount || 0) +
      Number(r.other_expense || 0);

    const overallTotal = rows.reduce((sum, r) => sum + calcAmount(r), 0);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${eventId}.pdf"`);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    doc.pipe(res);

    const MARGIN = 40;
    const PAGE_WIDTH = doc.page.width;
    const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

    // Initial positioning
    doc.y = MARGIN;

    // College Header (Center)
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('K.S.Rangasamy College of Technology (Autonomous), Tiruchengode – 637 215', { align: 'center', width: CONTENT_WIDTH });
    doc.moveDown(0.3);
    
    doc.fontSize(11).text('Consolidated Bill - Expense Report', { align: 'center' });
    doc.moveDown(0.3);
    
    doc.fontSize(11).text('Service Motto Volunteers', { align: 'center' });
    doc.moveDown(0.3);
    
    doc.fontSize(10).font('Helvetica').text(`Event ID: ${eventId}`, { align: 'center' });
    doc.moveDown(1.5);

    // Date (Top Right)
    const dateStr = formatDate(new Date());
    doc.fontSize(10).font('Helvetica').text(`Date: ${dateStr}`, MARGIN, doc.y, { align: 'right', width: CONTENT_WIDTH });
    doc.moveDown(0.5);

    // Table Setup
    const tableTop = doc.y;
    const colWidths = [45, 280, 100, 90]; // SN, Particulars, Date, Amount
    const colStarts = [MARGIN, MARGIN + colWidths[0], MARGIN + colWidths[0] + colWidths[1], MARGIN + colWidths[0] + colWidths[1] + colWidths[2]];
    const headers = ['S.No.', 'Expense (Folder)', 'Date', 'Amount (in Rs)'];

    // Draw header row
    const drawHeader = (y) => {
        doc.font('Helvetica-Bold').fontSize(10);
        headers.forEach((h, i) => {
            doc.text(h, colStarts[i] + 5, y + 8, { width: colWidths[i] - 10, align: i === 3 ? 'center' : 'left' });
        });
        // Table frame
        doc.rect(MARGIN, y, CONTENT_WIDTH, 25).stroke();
        // Column dividers
        for(let i=1; i<4; i++) {
            doc.moveTo(colStarts[i], y).lineTo(colStarts[i], y + 25).stroke();
        }
        return y + 25;
    };

    let tableY = drawHeader(tableTop);

    // Set font for rows
    doc.font('Helvetica').fontSize(9);

    rows.forEach((r, idx) => {
        const itemAmount = calcAmount(r);
        const rowDate = formatCompactDate(r.created_at);
        const titleText = `[${r.folder_name || 'No Folder'}] ${r.expense_title || '-'}`;
        
        // Dynamic row height
        const textHeight = doc.heightOfString(titleText, { width: colWidths[1] - 10 });
        const rowHeight = Math.max(textHeight + 15, 25);

        // Page break
        if (tableY + rowHeight > doc.page.height - 100) {
            doc.addPage();
            tableY = drawHeader(MARGIN);
            doc.font('Helvetica').fontSize(9);
        }

        // Draw cells
        doc.text((idx + 1).toString() + '.', colStarts[0] + 15, tableY + (rowHeight/2 - 4.5));
        doc.text(titleText, colStarts[1] + 5, tableY + (rowHeight/2 - 4.5), { width: colWidths[1] - 10 });
        doc.text(rowDate, colStarts[2] + 25, tableY + (rowHeight/2 - 4.5));
        doc.text(`${Math.floor(itemAmount)}/-`, colStarts[3], tableY + (rowHeight/2 - 4.5), { width: colWidths[3] - 5, align: 'right' });

        // Borders
        doc.rect(MARGIN, tableY, CONTENT_WIDTH, rowHeight).stroke();
        for(let i=1; i<4; i++) {
            doc.moveTo(colStarts[i], tableY).lineTo(colStarts[i], tableY + rowHeight).stroke();
        }

        tableY += rowHeight;
    });

    // Total Row
    doc.font('Helvetica-Bold');
    doc.text('Grand Total', MARGIN + 220, tableY + 8);
    doc.text(`${Math.floor(overallTotal)}/-`, colStarts[3], tableY + 8, { width: colWidths[3] - 5, align: 'right' });
    doc.rect(MARGIN, tableY, CONTENT_WIDTH, 25).stroke();
    doc.moveTo(colStarts[3], tableY).lineTo(colStarts[3], tableY + 25).stroke();

    tableY += 40;

    // Amount in Words
    const words = numberToWords(overallTotal);
    doc.font('Helvetica-BoldOblique').fontSize(10);
    doc.text(`(Rupees ${words} Only)`, MARGIN, tableY, { align: 'center', width: CONTENT_WIDTH });

    tableY += 60;

    // Footer signatures
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Faculty Coordinator', MARGIN, tableY);
    doc.moveDown(0.3);
    doc.text('SM Volunteers', MARGIN, doc.y);

    doc.end();

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /expenses/export/excel/:eventId
 * Server-side Excel export of all expense data
 */
router.get('/export/excel/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { eventId } = req.params;

    const rows = await getExportExpensesRows(db, eventId);
    const calcAmount = (r) =>
      Number(r.breakfast_amount || 0) +
      Number(r.lunch_amount || 0) +
      Number(r.dinner_amount || 0) +
      Number(r.refreshment_amount || 0) +
      Number(r.accommodation_amount || 0) +
      Number(r.fuel_amount || 0) +
      Number(r.other_expense || 0);

    const overallTotal = rows.reduce((sum, r) => sum + calcAmount(r), 0);

    const data = rows.map((r) => ({
      Folder: r.folder_name || '',
      Date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
      Title: r.expense_title || '',
      Category: r.category || '',
        Amount: calcAmount(r),
      'Created By': r.created_by_name || '',
      'From Location': r.transport_from || '',
      'To Location': r.transport_to || ''
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Expenses');

    // Summary sheet
    const summarySheet = xlsx.utils.json_to_sheet([
      { Metric: 'Overall Total', Value: overallTotal }
    ]);
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${eventId}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
