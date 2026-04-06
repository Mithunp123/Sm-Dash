import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireAdmin, allowFinance, blockVolunteer } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import xlsx from 'xlsx';
import { numberToWords, formatCompactDate, formatDate } from '../utils/formatters.js';

const router = express.Router();

// Helper functions for database queries
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

// ============================================
// CATEGORIES ENDPOINTS
// ============================================

// Get all categories for an event
router.get('/categories/event/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { eventId } = req.params;
    const db = getDatabase();

    const categories = await all(
      db,
      'SELECT * FROM financial_categories WHERE event_id = ? ORDER BY created_at DESC',
      [eventId]
    );

    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create category (Admin & Office Bearer)
router.post('/categories', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { eventId, categoryName, categoryType } = req.body;

    if (!eventId || !categoryName || !categoryType) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!['expense', 'collection'].includes(categoryType)) {
      return res.status(400).json({ success: false, message: 'Invalid category type' });
    }

    const db = getDatabase();
    const result = await run(
      db,
      'INSERT INTO financial_categories (event_id, category_name, category_type) VALUES (?, ?, ?)',
      [eventId, categoryName, categoryType]
    );

    await logActivity(req.user.id, 'CREATE_CATEGORY', { eventId, categoryName, categoryType }, req, {
      action_type: 'CREATE',
      module_name: 'finance',
      action_description: `Created category: ${categoryName}`,
      reference_id: result.lastID
    });

    res.json({ success: true, message: 'Category created successfully', categoryId: result.lastID });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete category (Admin only)
router.delete('/categories/:categoryId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const db = getDatabase();

    const category = await get(db, 'SELECT * FROM financial_categories WHERE id = ?', [categoryId]);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    await run(db, 'DELETE FROM financial_categories WHERE id = ?', [categoryId]);

    await logActivity(req.user.id, 'DELETE_CATEGORY', { categoryId, categoryName: category.category_name }, req, {
      action_type: 'DELETE',
      module_name: 'finance',
      action_description: `Deleted category: ${category.category_name}`,
      reference_id: categoryId
    });

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// EXPENSES ENDPOINTS
// ============================================

// Get all expenses for an event/category
router.get('/expenses', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { eventId, categoryId } = req.query;
    const db = getDatabase();

    let query = 'SELECT * FROM financial_expenses WHERE 1=1';
    const params = [];

    if (eventId) {
      query += ' AND event_id = ?';
      params.push(eventId);
    }

    if (categoryId) {
      query += ' AND category_id = ?';
      params.push(categoryId);
    }

    query += ' ORDER BY created_at DESC';

    const expenses = await all(db, query, params);

    res.json({ success: true, expenses });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create expense (Admin & Office Bearer only)
router.post('/expenses', authenticateToken, allowFinance, async (req, res) => {
  try {
    const {
      eventId,
      categoryId,
      transportFrom,
      transportTo,
      transportMode,
      fuelAmount,
      breakfastAmount,
      lunchAmount,
      dinnerAmount,
      refreshmentAmount
    } = req.body;

    if (!eventId || !categoryId) {
      return res.status(400).json({ success: false, message: 'Event and category are required' });
    }

    const db = getDatabase();

    // Calculate totals
    const fuel = parseFloat(fuelAmount) || 0;
    const breakfast = parseFloat(breakfastAmount) || 0;
    const lunch = parseFloat(lunchAmount) || 0;
    const dinner = parseFloat(dinnerAmount) || 0;
    const refreshment = parseFloat(refreshmentAmount) || 0;
    const travelTotal = fuel;
    const foodTotal = breakfast + lunch + dinner + refreshment;
    const grandTotal = travelTotal + foodTotal;

    const result = await run(
      db,
      `INSERT INTO financial_expenses 
       (event_id, category_id, transport_from, transport_to, transport_mode, fuel_amount, breakfast_amount, lunch_amount, dinner_amount, refreshment_amount, travel_total, food_total, grand_total, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        categoryId,
        transportFrom || null,
        transportTo || null,
        transportMode || null,
        fuel,
        breakfast,
        lunch,
        dinner,
        refreshment,
        travelTotal,
        foodTotal,
        grandTotal,
        req.user.id
      ]
    );

    // Fetch the created expense with calculated totals
    const expense = await get(db, 'SELECT * FROM financial_expenses WHERE id = ?', [result.lastID]);

    await logActivity(req.user.id, 'CREATE_EXPENSE', { eventId, categoryId }, req, {
      action_type: 'CREATE',
      module_name: 'finance',
      action_description: `Created expense: $${expense.grand_total || 0}`,
      reference_id: result.lastID
    });

    res.json({ success: true, message: 'Expense created successfully', expenseId: result.lastID, expense });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update expense (Admin & Office Bearer, but only their own or admin can update all)
router.put('/expenses/:expenseId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const {
      transportFrom,
      transportTo,
      transportMode,
      fuelAmount,
      breakfastAmount,
      lunchAmount,
      dinnerAmount,
      refreshmentAmount
    } = req.body;

    const db = getDatabase();

    const expense = await get(db, 'SELECT * FROM financial_expenses WHERE id = ?', [expenseId]);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    // Office Bearer can only edit their own, Admin can edit all
    if (req.user.role === 'office_bearer' && expense.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own expenses' });
    }

    // Calculate totals
    const fuel = parseFloat(fuelAmount) || 0;
    const breakfast = parseFloat(breakfastAmount) || 0;
    const lunch = parseFloat(lunchAmount) || 0;
    const dinner = parseFloat(dinnerAmount) || 0;
    const refreshment = parseFloat(refreshmentAmount) || 0;
    const travelTotal = fuel;
    const foodTotal = breakfast + lunch + dinner + refreshment;
    const grandTotal = travelTotal + foodTotal;

    await run(
      db,
      `UPDATE financial_expenses 
       SET transport_from = ?, transport_to = ?, transport_mode = ?, fuel_amount = ?, 
           breakfast_amount = ?, lunch_amount = ?, dinner_amount = ?, refreshment_amount = ?, 
           travel_total = ?, food_total = ?, grand_total = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        transportFrom || null,
        transportTo || null,
        transportMode || null,
        fuel,
        breakfast,
        lunch,
        dinner,
        refreshment,
        travelTotal,
        foodTotal,
        grandTotal,
        expenseId
      ]
    );

    const updated = await get(db, 'SELECT * FROM financial_expenses WHERE id = ?', [expenseId]);

    await logActivity(req.user.id, 'UPDATE_EXPENSE', { expenseId }, req, {
      action_type: 'UPDATE',
      module_name: 'finance',
      action_description: `Updated expense: $${updated.grand_total || 0}`,
      reference_id: expenseId
    });

    res.json({ success: true, message: 'Expense updated successfully', expense: updated });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete expense (Admin only)
router.delete('/expenses/:expenseId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const db = getDatabase();

    const expense = await get(db, 'SELECT * FROM financial_expenses WHERE id = ?', [expenseId]);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    await run(db, 'DELETE FROM financial_expenses WHERE id = ?', [expenseId]);

    await logActivity(req.user.id, 'DELETE_EXPENSE', { expenseId }, req, {
      action_type: 'DELETE',
      module_name: 'finance',
      action_description: `Deleted expense: $${expense.grand_total || 0}`,
      reference_id: expenseId
    });

    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// COLLECTIONS ENDPOINTS
// ============================================

// Get collections (Admin sees all, Office Bearer sees only their entries)
router.get('/collections', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { eventId } = req.query;
    const db = getDatabase();

    let query = 'SELECT * FROM fund_collections WHERE 1=1';
    const params = [];

    if (eventId) {
      query += ' AND event_id = ?';
      params.push(eventId);
    }

    // Office Bearer: only see their own collections
    if (req.user.role === 'office_bearer') {
      query += ' AND user_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY created_at DESC';

    const collections = await all(db, query, params);

    res.json({ success: true, collections });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create collection (Admin & Office Bearer)
router.post('/collections', authenticateToken, allowFinance, async (req, res) => {
  try {
    const {
      eventId,
      categoryId,
      payerName,
      contributedAmount,
      department,
      contributorType,
      paymentMode
    } = req.body;

    if (!eventId || !categoryId || !payerName || !contributedAmount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!['staff', 'student', 'other'].includes(contributorType)) {
      return res.status(400).json({ success: false, message: 'Invalid contributor type' });
    }

    const db = getDatabase();

    // received_by is auto-filled from JWT token
    const result = await run(
      db,
      `INSERT INTO fund_collections 
       (event_id, category_id, payer_name, contributed_amount, department, contributor_type, payment_mode, received_by, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        categoryId,
        payerName,
        contributedAmount,
        department || null,
        contributorType,
        paymentMode || 'cash',
        req.user.name, // auto-filled from JWT
        req.user.id    // auto-filled from JWT
      ]
    );

    const collection = await get(db, 'SELECT * FROM fund_collections WHERE id = ?', [result.lastID]);

    await logActivity(req.user.id, 'CREATE_COLLECTION', { eventId, categoryId, amount: contributedAmount }, req, {
      action_type: 'CREATE',
      module_name: 'finance',
      action_description: `Created collection: $${contributedAmount}`,
      reference_id: result.lastID
    });

    res.json({ success: true, message: 'Collection created successfully', collectionId: result.lastID, collection });
  } catch (error) {
    console.error('Error creating collection:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete collection (Admin only)
router.delete('/collections/:collectionId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { collectionId } = req.params;
    const db = getDatabase();

    const collection = await get(db, 'SELECT * FROM fund_collections WHERE id = ?', [collectionId]);
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    await run(db, 'DELETE FROM fund_collections WHERE id = ?', [collectionId]);

    await logActivity(req.user.id, 'DELETE_COLLECTION', { collectionId }, req, {
      action_type: 'DELETE',
      module_name: 'finance',
      action_description: `Deleted collection: $${collection.contributed_amount}`,
      reference_id: collectionId
    });

    res.json({ success: true, message: 'Collection deleted successfully' });
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// EVENT SUMMARY (Admin + Office Bearer)
// ============================================

router.get('/event-summary/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { eventId } = req.params;
    const db = getDatabase();

    // Calculate total expenses
    const expenseResult = await get(
      db,
      `SELECT SUM(COALESCE(fuel_amount + breakfast_amount + lunch_amount + dinner_amount + refreshment_amount, 0)) as total_expense
       FROM financial_expenses WHERE event_id = ?`,
      [eventId]
    );

    const totalExpense = expenseResult?.total_expense || 0;

    // Calculate total collections
    const collectionResult = await get(
      db,
      `SELECT SUM(COALESCE(contributed_amount, 0)) as total_collection
       FROM fund_collections WHERE event_id = ?`,
      [eventId]
    );

    const totalCollection = collectionResult?.total_collection || 0;

    const balance = totalCollection - totalExpense;

    res.json({
      success: true,
      summary: {
        eventId,
        totalExpense,
        totalCollection,
        balance
      }
    });
  } catch (error) {
    console.error('Error fetching event summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ANALYTICS / LEGACY BILL HELPERS
// ============================================

// Legacy summary endpoint (used by old bills module)
router.get('/summary', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];
    const [yr, mo] = today.split('-');
    const q = async (sql, p = []) => { const r = await get(db, sql, p); return r ? (r.total || 0) : 0; };
    const [todayTotal, monthTotal, yearTotal, collegeFund, studentContrib] = await Promise.all([
      q(`SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE bill_date = ?`, [today]),
      q(`SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE DATE_FORMAT(bill_date, '%Y-%m') = ?`, [`${yr}-${mo}`]),
      q(`SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE YEAR(bill_date) = ?`, [yr]),
      q(`SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE amount_source = 'College Fund'`),
      q(`SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE amount_source = 'Student Contribution'`),
    ]);
    res.json({ success: true, summary: { todayTotal, monthTotal, yearTotal, collegeFund, studentContrib } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get individual bill items (legacy)
router.get('/:id/items', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const items = await all(db, 'SELECT * FROM bill_items WHERE bill_id = ?', [req.params.id]);
    res.json({ success: true, items });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// QR code upload for bill folders (legacy feature)
// `multer`, `path`, and `fs` are imported at top of the file — reuse those imports.

const qrUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'qr_codes');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `event-qr-${req.params.id}-${Date.now()}${ext}`);
    }
  })
});

router.post('/folders/:id/qr', authenticateToken, requireAdmin, qrUpload.single('qr'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const db = getDatabase();
    const dbPath = `/uploads/qr_codes/${req.file.filename}`;
    await run(db, 'UPDATE bill_folders SET qr_image = ? WHERE id = ?', [dbPath, req.params.id]);
    res.json({ success: true, qr_image: dbPath });
  } catch (e) {
    console.error('QR Upload error DETAILS:', e);
    res.status(500).json({ success: false, message: e.message || 'Server error' });
  }
});

// Analytics helpers (legacy monthly/source reports)
router.get('/analytics/monthly', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const year = req.query.year || new Date().getFullYear();
    const rows = await all(db, `SELECT DATE_FORMAT(bill_date, '%m') as month, COALESCE(SUM(amount),0) as total FROM bills WHERE YEAR(bill_date) = ? GROUP BY month ORDER BY month`, [String(year)]);
    const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const data = labels.map((label,i)=>{const m = String(i+1).padStart(2,'0'); const r = rows.find(x=>x.month===m); return { month: label, total: r?Number(r.total):0 }; });
    res.json({ success: true, data });
  } catch(e){ res.status(500).json({ success:false, message:'Server error' }); }
});

router.get('/analytics/sources', authenticateToken, allowFinance, async (req,res)=>{
  try {
    const db = getDatabase();
    const rows = await all(db, `SELECT COALESCE(amount_source,'Unknown') as source, COALESCE(SUM(amount),0) as total FROM bills GROUP BY amount_source ORDER BY total DESC`, []);
    res.json({ success: true, data: rows.map(r=>({ source:r.source, total:Number(r.total) })) });
  } catch(e){ res.status(500).json({ success:false, message:'Server error' }); }
});

// ============================================
// SETTINGS ENDPOINTS (Admin only)
// ============================================

const qrSettingsUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'qr_codes');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `settings-qr-${Date.now()}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const upsertSetting = async (db, { settingKey, settingValue, dataType = 'string', userId }) => {
  await run(
    db,
    `
    INSERT INTO settings (setting_key, setting_value, data_type, updated_by)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      setting_value = VALUES(setting_value),
      data_type = VALUES(data_type),
      updated_by = VALUES(updated_by),
      updated_at = CURRENT_TIMESTAMP
    `,
    [settingKey, settingValue, dataType, userId]
  );
};

const getSettingValue = async (db, key) => {
  try {
    const row = await get(db, 'SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
    return row?.setting_value ?? null;
  } catch {
    return null;
  }
};

// Get finance settings (spec)
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();

    const [fundraising_enabled, qr_code_path, fund_entry_enabled] = await Promise.all([
      getSettingValue(db, 'fundraising_enabled'),
      getSettingValue(db, 'qr_code_path'),
      getSettingValue(db, 'fund_entry_enabled')
    ]);

    // Construct full URL for QR code if path is relative
    let fullQrPath = qr_code_path || '';
    if (fullQrPath && fullQrPath.startsWith('/')) {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      fullQrPath = `${protocol}://${host}${fullQrPath}`;
    }

    res.json({
      success: true,
      fundraising_enabled: fundraising_enabled === 'true' || fundraising_enabled === '1',
      fund_entry_enabled:
        fund_entry_enabled === 'true' || fund_entry_enabled === '1' || fund_entry_enabled === true,
      qr_code_path: fullQrPath
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update settings (Admin only) - legacy compatibility
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { collectionEnabled, qrImageUrl, fundraisingEnabled } = req.body || {};

    const enabledValue =
      fundraisingEnabled !== undefined ? fundraisingEnabled : collectionEnabled;

    if (enabledValue !== undefined) {
      await upsertSetting(db, {
        settingKey: 'fundraising_enabled',
        settingValue: enabledValue ? 'true' : 'false',
        dataType: 'boolean',
        userId: req.user.id
      });
    }

    if (qrImageUrl !== undefined) {
      await upsertSetting(db, {
        settingKey: 'qr_code_path',
        settingValue: qrImageUrl || '',
        dataType: 'string',
        userId: req.user.id
      });
    }

    await logActivity(req.user.id, 'UPDATE_SETTINGS', req.body, req, {
      action_type: 'UPDATE',
      module_name: 'finance',
      action_description: 'Updated fundraising settings',
      reference_id: null
    });

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle fundraising (Admin only)
router.post('/settings/fundraising/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { enabled } = req.body || {};

    if (enabled === undefined) {
      return res.status(400).json({ success: false, message: 'enabled is required' });
    }

    const normalized = !!enabled;

    await upsertSetting(db, {
      settingKey: 'fundraising_enabled',
      settingValue: normalized ? 'true' : 'false',
      dataType: 'boolean',
      userId: req.user.id
    });

    await logActivity(req.user.id, 'TOGGLE_FUNDRAISING', { enabled: normalized }, req, {
      action_type: 'UPDATE',
      module_name: 'finance',
      action_description: `Fundraising ${normalized ? 'enabled' : 'disabled'}`
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Toggle fundraising error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle fund entry (students can only VIEW + PAY; no entry allowed when disabled)
router.post('/settings/fund-entry/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { enabled } = req.body || {};

    if (enabled === undefined) {
      return res.status(400).json({ success: false, message: 'enabled is required' });
    }

    const normalized = !!enabled;

    await upsertSetting(db, {
      settingKey: 'fund_entry_enabled',
      settingValue: normalized ? 'true' : 'false',
      dataType: 'boolean',
      userId: req.user.id
    });

    await logActivity(req.user.id, 'TOGGLE_FUND_ENTRY', { enabled: normalized }, req, {
      action_type: 'UPDATE',
      module_name: 'finance',
      action_description: `Fund entry ${normalized ? 'enabled' : 'disabled'}`
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Toggle fund entry error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload QR code (Admin only)
router.post(
  '/settings/qrcode/upload',
  authenticateToken,
  requireAdmin,
  qrSettingsUpload.single('qr_code'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const db = getDatabase();
      const qr_code_path = `/uploads/qr_codes/${req.file.filename}`;

      // Optional: delete previously uploaded QR file if present and different
      const existingPath = await getSettingValue(db, 'qr_code_path');
      if (existingPath && typeof existingPath === 'string' && existingPath !== qr_code_path) {
        try {
          const actualPath = path.join(process.cwd(), 'public', existingPath.replace(/^\/uploads\//, ''));
          if (fs.existsSync(actualPath)) fs.unlinkSync(actualPath);
        } catch {
          // Non-fatal; ignore cleanup errors
        }
      }

      await upsertSetting(db, {
        settingKey: 'qr_code_path',
        settingValue: qr_code_path,
        dataType: 'string',
        userId: req.user.id
      });

      await logActivity(req.user.id, 'UPLOAD_QR_CODE', { qr_code_path }, req, {
        action_type: 'UPDATE',
        module_name: 'finance',
        action_description: 'Uploaded fundraising QR code'
      });

      // Construct full URL for response
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const fullUrl = `${protocol}://${host}${qr_code_path}`;

      res.json({ success: true, qr_code_path: fullUrl });
    } catch (error) {
      console.error('QR upload error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Delete QR code (Admin only)
router.post('/settings/qrcode/delete', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const existingPath = await getSettingValue(db, 'qr_code_path');

    // Attempt delete file
    if (existingPath && typeof existingPath === 'string' && existingPath.startsWith('/uploads/')) {
      try {
        const actualPath = path.join(process.cwd(), 'public', existingPath.replace(/^\/uploads\//, ''));
        if (fs.existsSync(actualPath)) fs.unlinkSync(actualPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    await upsertSetting(db, {
      settingKey: 'qr_code_path',
      settingValue: '',
      dataType: 'string',
      userId: req.user.id
    });

    await logActivity(req.user.id, 'DELETE_QR_CODE', { existingPath }, req, {
      action_type: 'UPDATE',
      module_name: 'finance',
      action_description: 'Deleted fundraising QR code'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete QR error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Combined financial summary (used by EventFundsManagement UI)
router.get('/summary/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { eventId } = req.params;

    const totalFundParams = [eventId];
    let totalFundQuery = `SELECT COALESCE(SUM(amount), 0) as total_fund_raised FROM fund_collections WHERE event_id = ?`;
    if (req.user.role === 'student') {
      totalFundQuery += ` AND received_by = ?`;
      totalFundParams.push(req.user.id);
    }

    const [totalFund, expenseData] = await Promise.all([
      get(db, totalFundQuery, totalFundParams),
      all(
        db,
        `SELECT 
          COALESCE(NULLIF(grand_total, 0),
            COALESCE(breakfast_amount, 0) +
            COALESCE(lunch_amount, 0) +
            COALESCE(dinner_amount, 0) +
            COALESCE(refreshment_amount, 0) +
            COALESCE(accommodation_amount, 0) +
            COALESCE(fuel_amount, 0) +
            COALESCE(other_expense, 0)
          ) as computed_amount
        FROM expenses WHERE event_id = ?`,
        [eventId]
      )
    ]);

    // Calculate total expenses using grand_total fallback for compatibility
    const total_expenses = (expenseData || []).reduce((sum, expense) => {
      return sum + Number(expense.computed_amount || 0);
    }, 0);

    const total_fund_raised = totalFund?.total_fund_raised || 0;

    res.json({
      success: true,
      summary: {
        total_fund_raised,
        total_expenses,
        balance: total_fund_raised - total_expenses
      }
    });
  } catch (error) {
    console.error('Finance summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /finance/bills-report/pdf/:eventId
 * Export bills report as PDF organized by folders
 */
router.get('/bills-report/pdf/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { eventId } = req.params;

    // Get all folders with their expenses
    const folders = await all(
      db,
      `
      SELECT 
        bf.id,
        bf.folder_name,
        bf.description,
        bf.created_at as folder_created_at
      FROM bill_folders bf
      WHERE bf.event_id = ?
      ORDER BY bf.created_at DESC
      `,
      [eventId]
    );

    // For each folder, get all expenses
    const foldersWithExpenses = [];
    for (const folder of folders) {
      const expenses = await all(
        db,
        `
        SELECT 
          e.*,
          u.name as created_by_name
        FROM expenses e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.folder_id = ?
        ORDER BY e.created_at DESC
        `,
        [folder.id]
      );
      
      foldersWithExpenses.push({
        ...folder,
        expenses: expenses || []
      });
    }

    const calcAmount = (r) =>
      Number(r.breakfast_amount || 0) +
      Number(r.lunch_amount || 0) +
      Number(r.dinner_amount || 0) +
      Number(r.refreshment_amount || 0) +
      Number(r.accommodation_amount || 0) +
      Number(r.fuel_amount || 0) +
      Number(r.other_expense || 0);

    const overallTotal = foldersWithExpenses.reduce((sum, folder) =>
      sum + folder.expenses.reduce((fSum, exp) => fSum + calcAmount(exp), 0), 0
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bills_report_${eventId}.pdf"`);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    doc.pipe(res);

    // Try to load logos
    const rootDir = path.resolve(process.cwd());
    const smLogoPath = path.join(rootDir, 'Images', 'Picsart_23-05-18_16-47-20-287-removebg-preview.png');
    const ksrctLogoPath = path.join(rootDir, 'Images', 'Brand_logo.png');

    const PAGE_WIDTH = doc.page.width;
    const LOGO_SIZE = 50;
    const TOP_MARGIN = 30;

    // Header with logos
    let currentY = TOP_MARGIN;
    if (fs.existsSync(smLogoPath)) {
      doc.image(smLogoPath, 30, currentY, { width: LOGO_SIZE, height: LOGO_SIZE });
    }
    if (fs.existsSync(ksrctLogoPath)) {
      doc.image(ksrctLogoPath, PAGE_WIDTH - 30 - LOGO_SIZE, currentY, { width: LOGO_SIZE, height: LOGO_SIZE });
    }

    currentY += LOGO_SIZE + 10;
    doc.y = currentY;

    // Title
    doc.fontSize(16).font('Helvetica-Bold').text('BILLS REPORT', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Event ID: ${eventId}`, { align: 'center' });
    
    // Date and Time on left side
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();
    doc.fontSize(9).text(`Date: ${dateStr}`, 30);
    doc.fontSize(9).text(`Time: ${timeStr}`, 30);
    
    doc.moveDown(0.5);

    // Overall Total
    doc.fontSize(11).font('Helvetica-Bold').text(`Overall Total: ₹${overallTotal.toFixed(2)}`, { align: 'left' });
    doc.moveDown(1);

    // For each folder, create a section
    for (const folder of foldersWithExpenses) {
      // Folder Header
      doc.fontSize(12).font('Helvetica-Bold').text(`Folder: ${folder.folder_name}`, { align: 'left' });
      if (folder.description) {
        doc.fontSize(9).font('Helvetica').text(`Description: ${folder.description}`);
      }
      doc.moveDown(0.3);

      // Folder expenses total
      const folderTotal = folder.expenses.reduce((sum, exp) => sum + calcAmount(exp), 0);
      doc.fontSize(10).font('Helvetica-Bold').text(`Folder Total: ₹${folderTotal.toFixed(2)}`);
      doc.moveDown(0.3);

      // Table Header
      const col1 = 30;
      const col2 = 110;
      const col3 = 190;
      const col4 = 270;
      const col5 = 350;
      const col6 = 420;

      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Date', col1, doc.y);
      doc.text('Title', col2, doc.y);
      doc.text('Category', col3, doc.y);
      doc.text('Amount', col4, doc.y);
      doc.text('Created By', col5, doc.y);
      
      doc.moveTo(30, doc.y).lineTo(PAGE_WIDTH - 30, doc.y).stroke();
      doc.moveDown(0.3);

      // Table Rows for this folder
      doc.font('Helvetica').fontSize(7);
      for (const exp of folder.expenses) {
        const date = exp.created_at ? new Date(exp.created_at).toLocaleDateString() : '-';
        const amount = calcAmount(exp);
        const title = (exp.expense_title || '-').substring(0, 15);
        const category = (exp.category || '-').substring(0, 10);
        const creator = (exp.created_by_name || '-').substring(0, 12);

        const rowY = doc.y;
        doc.text(date, col1, rowY, { width: 70 });
        doc.text(title, col2, rowY, { width: 70 });
        doc.text(category, col3, rowY, { width: 70 });
        doc.text(`₹${amount.toFixed(2)}`, col4, rowY, { width: 70, align: 'right' });
        doc.text(creator, col5, rowY, { width: 70 });
        
        doc.moveDown(0.35);
      }

      // Add spacing between folders
      doc.moveDown(1);
      doc.moveTo(30, doc.y).lineTo(PAGE_WIDTH - 30, doc.y).stroke();
      doc.moveDown(0.5);
    }

    doc.end();
  } catch (err) {
    console.error('Error generating bills PDF:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /finance/folder-report/pdf/:folderId
 * Export single folder report as PDF
 */
router.get('/folder-report/pdf/:folderId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { folderId } = req.params;

    const folder = await get(
      db,
      `SELECT * FROM bill_folders WHERE id = ?`,
      [folderId]
    );

    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const expenses = await all(
      db,
      `
      SELECT 
        e.*,
        u.name as created_by_name
      FROM expenses e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.folder_id = ?
      ORDER BY e.created_at DESC
      `,
      [folderId]
    );

    const calcAmount = (r) =>
      Number(r.breakfast_amount || 0) +
      Number(r.lunch_amount || 0) +
      Number(r.dinner_amount || 0) +
      Number(r.refreshment_amount || 0) +
      Number(r.accommodation_amount || 0) +
      Number(r.fuel_amount || 0) +
      Number(r.other_expense || 0);

    const folderTotal = (expenses || []).reduce((sum, exp) => sum + calcAmount(exp), 0);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${folder.folder_name}_report.pdf"`);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    doc.pipe(res);

    // Load Logos
    const rootDir = path.resolve(process.cwd());
    const smLogoPath = path.join(rootDir, 'Images', 'Picsart_23-05-18_16-47-20-287-removebg-preview.png');
    const ksrctLogoPath = path.join(rootDir, 'Images', 'Brand_logo.png');

    const MARGIN = 40;
    const PAGE_WIDTH = doc.page.width;
    const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

    // Initial positioning
    doc.y = MARGIN;

    // College Header (Center)
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('K.S.Rangasamy College of Technology (Autonomous), Tiruchengode – 637 215', { align: 'center', width: CONTENT_WIDTH });
    doc.moveDown(0.3);
    
    doc.fontSize(11).text('Consolidated Bill', { align: 'center' });
    doc.moveDown(0.3);
    
    doc.fontSize(11).text('Service Motto Volunteers', { align: 'center' });
    doc.moveDown(0.3);
    
    // Use Folder Name or Event Title as subheader
    doc.fontSize(11).text(`${folder.folder_name}`, { align: 'center' });
    doc.moveDown(1.5);

    // Date (Top Right of table area)
    const dateStr = formatDate(new Date());
    doc.fontSize(10).font('Helvetica').text(`Date: ${dateStr}`, MARGIN, doc.y, { align: 'right', width: CONTENT_WIDTH });
    doc.moveDown(0.5);

    // Table Setup
    const tableTop = doc.y;
    const colWidths = [45, 280, 100, 90]; // SN, Particulars, Date, Amount
    const colStarts = [MARGIN, MARGIN + colWidths[0], MARGIN + colWidths[0] + colWidths[1], MARGIN + colWidths[0] + colWidths[1] + colWidths[2]];
    const headers = ['S.No.', 'Expense Particulars', 'Date', 'Amount (in Rs)'];

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

    // Rows
    let totalVal = 0;
    doc.font('Helvetica').fontSize(9);

    (expenses || []).forEach((exp, idx) => {
        const itemAmount = calcAmount(exp);
        totalVal += itemAmount;
        const rowDate = formatCompactDate(exp.created_at);
        
        // Dynamic row height based on Particulars title
        const titleText = exp.expense_title || '-';
        const textHeight = doc.heightOfString(titleText, { width: colWidths[1] - 10 });
        const rowHeight = Math.max(textHeight + 15, 25);

        // Page break if row exceeds page
        if (tableY + rowHeight > doc.page.height - 100) {
            doc.addPage();
            tableY = drawHeader(MARGIN);
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
    doc.text('Total', MARGIN + 220, tableY + 8);
    doc.text(`${Math.floor(totalVal)}/-`, colStarts[3], tableY + 8, { width: colWidths[3] - 5, align: 'right' });
    doc.rect(MARGIN, tableY, CONTENT_WIDTH, 25).stroke();
    doc.moveTo(colStarts[3], tableY).lineTo(colStarts[3], tableY + 25).stroke();

    tableY += 40;

    // Amount in Words
    const words = numberToWords(totalVal);
    doc.font('Helvetica-BoldOblique').fontSize(10);
    doc.text(`(Rupees ${words} Only)`, MARGIN, tableY, { align: 'center', width: CONTENT_WIDTH });

    tableY += 60;

    // Footer - Left side signatures as shown in image
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Faculty Coordinator', MARGIN, tableY);
    doc.moveDown(0.3);
    doc.text('SM Volunteers', MARGIN, doc.y);

    doc.end();

  } catch (err) {
    console.error('Error generating folder PDF:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /finance/folder-report/excel/:folderId
 * Export single folder report as Excel
 */
router.get('/folder-report/excel/:folderId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { folderId } = req.params;

    const folder = await get(
      db,
      `SELECT * FROM bill_folders WHERE id = ?`,
      [folderId]
    );

    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const expenses = await all(
      db,
      `
      SELECT 
        e.*,
        u.name as created_by_name
      FROM expenses e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.folder_id = ?
      ORDER BY e.created_at DESC
      `,
      [folderId]
    );

    const calcAmount = (r) =>
      Number(r.breakfast_amount || 0) +
      Number(r.lunch_amount || 0) +
      Number(r.dinner_amount || 0) +
      Number(r.refreshment_amount || 0) +
      Number(r.accommodation_amount || 0) +
      Number(r.fuel_amount || 0) +
      Number(r.other_expense || 0);

    const data = (expenses || []).map((exp) => ({
      Date: exp.created_at ? new Date(exp.created_at).toLocaleDateString() : '',
      Title: exp.expense_title || '',
      Category: exp.category || '',
      Amount: calcAmount(exp),
      'Created By': exp.created_by_name || '',
      'From Location': exp.transport_from || '',
      'To Location': exp.transport_to || ''
    }));

    const folderTotal = data.reduce((sum, row) => sum + row.Amount, 0);
    data.push({
      Date: '',
      Title: `${folder.folder_name} Total`,
      Category: '',
      Amount: folderTotal,
      'Created By': '',
      'From Location': '',
      'To Location': ''
    });

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, folder.folder_name.substring(0, 31));

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${folder.folder_name}_report.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error generating folder Excel:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /finance/bills-report/excel/:eventId
 * Export bills report as Excel organized by folders
 */
router.get('/bills-report/excel/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const { eventId } = req.params;

    // Get all folders with their expenses
    const folders = await all(
      db,
      `
      SELECT 
        bf.id,
        bf.folder_name,
        bf.description
      FROM bill_folders bf
      WHERE bf.event_id = ?
      ORDER BY bf.created_at DESC
      `,
      [eventId]
    );

    const calcAmount = (r) =>
      Number(r.breakfast_amount || 0) +
      Number(r.lunch_amount || 0) +
      Number(r.dinner_amount || 0) +
      Number(r.refreshment_amount || 0) +
      Number(r.accommodation_amount || 0) +
      Number(r.fuel_amount || 0) +
      Number(r.other_expense || 0);

    const workbook = xlsx.utils.book_new();
    let overallTotal = 0;

    // Create a sheet for each folder
    for (const folder of folders) {
      const expenses = await all(
        db,
        `
        SELECT 
          e.*,
          u.name as created_by_name
        FROM expenses e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.folder_id = ?
        ORDER BY e.created_at DESC
        `,
        [folder.id]
      );

      const data = (expenses || []).map((exp) => ({
        Date: exp.created_at ? new Date(exp.created_at).toLocaleDateString() : '',
        Title: exp.expense_title || '',
        Category: exp.category || '',
        Amount: calcAmount(exp),
        'Created By': exp.created_by_name || '',
        'From Location': exp.transport_from || '',
        'To Location': exp.transport_to || ''
      }));

      const folderTotal = data.reduce((sum, row) => sum + row.Amount, 0);
      overallTotal += folderTotal;

      // Add folder summary at the end
      data.push({
        Date: '',
        Title: `${folder.folder_name} Total`,
        Category: '',
        Amount: folderTotal,
        'Created By': '',
        'From Location': '',
        'To Location': ''
      });

      const worksheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(workbook, worksheet, folder.folder_name.substring(0, 31)); // Excel sheet name limit
    }

    // Add summary sheet
    const summaryData = [
      { Metric: 'Overall Total', Value: overallTotal }
    ];
    const summarySheet = xlsx.utils.json_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bills_report_${eventId}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error generating bills Excel:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
