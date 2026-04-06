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

const getFundraisingEnabled = async (db) => {
  try {
    const row = await get(
      db,
      `SELECT setting_value
       FROM settings
       WHERE setting_key = 'fundraising_enabled'`
    );
    const raw = row?.setting_value;
    return raw === true || raw === 'true' || raw === '1';
  } catch {
    // If settings table is missing/uninitialized, default to disabled.
    return false;
  }
};

const getQRCodePath = async (db) => {
  try {
    const row = await get(
      db,
      `SELECT setting_value
       FROM settings
       WHERE setting_key = 'qr_code_path'`
    );
    return row?.setting_value || '';
  } catch {
    return '';
  }
};

const getFundEntryEnabled = async (db) => {
  try {
    const row = await get(
      db,
      `SELECT setting_value
       FROM settings
       WHERE setting_key = 'fund_entry_enabled'`
    );
    const raw = row?.setting_value;
    // Default TRUE if missing
    if (raw === undefined || raw === null || raw === '') return true;
    return raw === true || raw === 'true' || raw === '1';
  } catch {
    // If settings table is missing/uninitialized, default to enabled
    return true;
  }
};

const requireFundraisingEnabled = async (req, res, db) => {
  const enabled = await getFundraisingEnabled(db);
  if (!enabled && !['admin', 'student', 'office_bearer'].includes(req.user.role)) {
    res.status(403).json({
      success: false,
      message: 'Fund raising is currently disabled'
    });
    return false;
  }
  return true;
};

const validateAddCollection = (body) => {
  const {
    event_id,
    payer_name,
    amount,
    payment_mode,
    department,
    contributor_type,
    transaction_id,
    notes
  } = body || {};

  const paymentModeNormalized = payment_mode ? String(payment_mode).toLowerCase() : payment_mode;

  if (!event_id || !payer_name || amount === undefined || amount === null || !payment_mode) {
    return { ok: false, message: 'Missing required fields: event_id, payer_name, amount, payment_mode' };
  }

  const parsedAmount = parseFloat(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    return { ok: false, message: 'amount must be a positive number' };
  }

  if (!['cash', 'online', 'upi'].includes(paymentModeNormalized)) {
    return { ok: false, message: 'payment_mode must be one of "cash", "online", "upi"' };
  }

  const normalizedContributorType = contributor_type || 'other';

  // DB check constraints may require `transaction_id` to be non-null for online/UPI.
  // User requirement: transaction_id is not needed for QR flow, so we auto-fill a placeholder.
  const cleanedTransactionId = (() => {
    if (paymentModeNormalized === 'cash') return null;
    const trimmed = transaction_id ? String(transaction_id).trim() : '';
    return trimmed ? trimmed : 'QR';
  })();

  if (contributor_type && !['staff', 'student', 'other'].includes(contributor_type)) {
    return { ok: false, message: 'contributor_type must be one of: staff, student, other' };
  }

  return {
    ok: true,
    data: {
      event_id,
      payer_name: String(payer_name).trim(),
      amount: parsedAmount,
      department: department ? String(department).trim() : null,
      contributor_type: normalizedContributorType,
      payment_mode: paymentModeNormalized,
      transaction_id: cleanedTransactionId,
      notes: notes ? String(notes).trim() : null
    }
  };
};

/**
 * GET /fundraising/status
 * Get fundraising status and QR code
 */
router.get('/status', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const [fundraising_enabled, qr_code_path, fund_entry_enabled] = await Promise.all([
      getFundraisingEnabled(db),
      getQRCodePath(db),
      getFundEntryEnabled(db)
    ]);

    // Construct full URL for QR code if path is relative
    let fullQrPath = qr_code_path;
    if (qr_code_path && qr_code_path.startsWith('/')) {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      fullQrPath = `${protocol}://${host}${qr_code_path}`;
    }

    res.json({
      success: true,
      fundraising_enabled,
      fund_entry_enabled,
      qr_code_path: fullQrPath
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /fundraising/add
 * Add a new fund collection entry
 */
router.post('/add', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const canProceed = await requireFundraisingEnabled(req, res, db);
    if (!canProceed) return;

    // Enforce manual enable/disable control for entries (Scan & Pay / Add Collection)
    const fundEntryEnabled = await getFundEntryEnabled(db);
    if (!fundEntryEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Fund entry is currently disabled'
      });
    }

    const validated = validateAddCollection(req.body);
    if (!validated.ok) {
      return res.status(400).json({ success: false, message: validated.message });
    }

    const data = validated.data;

    const paymentModeToInsert = data.payment_mode;
    let result;
    try {
      result = await run(
        db,
        `
        INSERT INTO fund_collections
          (event_id, payer_name, amount, department, contributor_type, payment_mode, transaction_id, received_by, notes)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          data.event_id,
          data.payer_name,
          data.amount,
          data.department,
          data.contributor_type,
          paymentModeToInsert,
          data.transaction_id,
          req.user.id,
          data.notes
        ]
      );
    } catch (err) {
      // If DB has different check constraint values for payment_mode (e.g. `online` vs `upi`),
      // retry with the alternate value.
      const isPaymentModeCheck =
        err &&
        typeof err.message === 'string' &&
        err.message.toLowerCase().includes('fund_collections_chk');

      if (
        isPaymentModeCheck &&
        (paymentModeToInsert === 'online' || paymentModeToInsert === 'upi')
      ) {
        const alternatePaymentMode = paymentModeToInsert === 'online' ? 'upi' : 'online';
        result = await run(
          db,
          `
          INSERT INTO fund_collections
            (event_id, payer_name, amount, department, contributor_type, payment_mode, transaction_id, received_by, notes)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            data.event_id,
            data.payer_name,
            data.amount,
            data.department,
            data.contributor_type,
            alternatePaymentMode,
            data.transaction_id,
            req.user.id,
            data.notes
          ]
        );
      } else {
        throw err;
      }
    }

    await logActivity(req.user.id, 'ADD_FUND_COLLECTION', { event_id: data.event_id, payer_name: data.payer_name, amount: data.amount }, req, {
      action_type: 'CREATE',
      module_name: 'fundraising',
      action_description: `Added fund collection: ${data.payer_name} (${data.amount})`,
      reference_id: result.lastID
    });

    res.json({
      success: true,
      message: 'Fund collection entry added successfully',
      id: result.lastID
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /fundraising/list/:eventId
 * Get all fund collections for an event
 */
router.get('/list/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const canProceed = await requireFundraisingEnabled(req, res, db);
    if (!canProceed) return;

    const { eventId } = req.params;
    const { payment_mode, start_date, end_date, received_by } = req.query;

    let query = `
      SELECT
        fc.*,
        u.name as received_by_name
      FROM fund_collections fc
      LEFT JOIN users u ON fc.received_by = u.id
      WHERE fc.event_id = ?
    `;
    const params = [eventId];

    if (payment_mode) {
      // Backward/forward compatibility if DB stores either `online` or `upi`
      if (payment_mode === 'online') {
        query += ` AND fc.payment_mode IN ('online', 'upi')`;
        params.push('online', 'upi');
      } else {
        query += ` AND fc.payment_mode = ?`;
        params.push(payment_mode);
      }
    }

    if (start_date && end_date) {
      query += ` AND DATE(fc.created_at) BETWEEN ? AND ?`;
      params.push(start_date, end_date);
    }

    // Only admin can filter by received_by
    if (req.user.role === 'student') {
      query += ` AND fc.received_by = ?`;
      params.push(req.user.id);
    } else if (req.user.role === 'admin' && received_by) {
      query += ` AND fc.received_by = ?`;
      params.push(received_by);
    }

    query += ` ORDER BY fc.created_at DESC`;

    const collections = await all(db, query, params);

    res.json({
      success: true,
      collections,
      count: collections.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /fundraising/summary/:eventId
 * Get fund collection summary for an event
 */
router.get('/summary/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const canProceed = await requireFundraisingEnabled(req, res, db);
    if (!canProceed) return;

    const { eventId } = req.params;

    const [dailySummary, userWiseSummary, totalFund] = await Promise.all([
      all(
        db,
        `
        SELECT
          DATE(created_at) as collection_date,
          COUNT(*) as entry_count,
          SUM(amount) as daily_total,
          SUM(CASE WHEN payment_mode = 'cash' THEN amount ELSE 0 END) as cash_total,
          SUM(CASE WHEN payment_mode IN ('online', 'upi') THEN amount ELSE 0 END) as online_total
        FROM fund_collections
        WHERE event_id = ?
        GROUP BY DATE(created_at)
        ORDER BY collection_date DESC
        `,
        [eventId]
      ),
      all(
        db,
        `
        SELECT
          fc.received_by,
          u.name,
          COUNT(*) as total_entries,
          SUM(fc.amount) as total_contributed
        FROM fund_collections fc
        LEFT JOIN users u ON fc.received_by = u.id
        WHERE fc.event_id = ?
        GROUP BY fc.received_by
        ORDER BY total_contributed DESC
        `,
        [eventId]
      ),
      get(
        db,
        `
        SELECT COALESCE(SUM(amount), 0) as total_amount
        FROM fund_collections
        WHERE event_id = ?
        `,
        [eventId]
      )
    ]);

    res.json({
      success: true,
      total_fund_raised: totalFund?.total_amount || 0,
      daily_summary: dailySummary,
      user_wise_contribution: userWiseSummary,
      total_collection_days: dailySummary.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /fundraising/user-contribution/:eventId
 * Get user-wise contribution breakdown
 */
router.get('/user-contribution/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const db = getDatabase();
    const canProceed = await requireFundraisingEnabled(req, res, db);
    if (!canProceed) return;

    const { eventId } = req.params;

    const contributions = await all(
      db,
      `
      SELECT
        fc.received_by,
        u.name as user_name,
        COUNT(*) as total_entries,
        SUM(fc.amount) as total_contributed
      FROM fund_collections fc
      LEFT JOIN users u ON fc.received_by = u.id
      WHERE fc.event_id = ?
      GROUP BY fc.received_by
      ORDER BY total_contributed DESC
      `,
      [eventId]
    );

    res.json({
      success: true,
      contributions
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /fundraising/:id
 * Delete a fund collection entry (Admin only)
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { payer_name, amount, payment_mode, department, contributor_type, transaction_id, notes } = req.body;

    if (!payer_name || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Payer name and amount are required' });
    }

    const paymentModeNormalized = payment_mode ? String(payment_mode).toLowerCase() : 'cash';
    const cleanedTransactionId = (() => {
      if (paymentModeNormalized === 'cash') return null;
      const trimmed = transaction_id ? String(transaction_id).trim() : '';
      return trimmed ? trimmed : 'QR';
    })();

    const updateQuery = `
      UPDATE fund_collections 
      SET payer_name = ?, amount = ?, payment_mode = ?, department = ?, 
          contributor_type = ?, transaction_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    let result;
    try {
      result = await run(db, updateQuery, [
        payer_name,
        parseFloat(amount),
        paymentModeNormalized,
        department || null,
        contributor_type || 'student',
        cleanedTransactionId,
        notes || null,
        id
      ]);
    } catch (err) {
      // If DB expects `upi` instead of `online` (or vice-versa), retry once.
      const isPaymentModeCheck =
        err &&
        typeof err.message === 'string' &&
        err.message.toLowerCase().includes('fund_collections_chk');

      if (isPaymentModeCheck && (paymentModeNormalized === 'online' || paymentModeNormalized === 'upi')) {
        const alternatePaymentMode = paymentModeNormalized === 'online' ? 'upi' : 'online';
        result = await run(db, updateQuery, [
          payer_name,
          parseFloat(amount),
          alternatePaymentMode,
          department || null,
          contributor_type || 'student',
          cleanedTransactionId,
          notes || null,
          id
        ]);
      } else {
        throw err;
      }
    }

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Collection entry not found' });
    }

    await logActivity(req.user.id, 'UPDATE_FUND_COLLECTION', { id, payer_name, amount }, req, {
      action_type: 'UPDATE',
      module_name: 'fundraising',
      action_description: `Updated fund collection id=${id}`,
      reference_id: id
    });

    res.json({
      success: true,
      message: 'Fund collection entry updated successfully',
      affectedRows: result.changes
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const result = await run(db, 'DELETE FROM fund_collections WHERE id = ?', [id]);

    await logActivity(req.user.id, 'DELETE_FUND_COLLECTION', { id }, req, {
      action_type: 'DELETE',
      module_name: 'fundraising',
      action_description: `Deleted fund collection id=${id}`,
      reference_id: id
    });

    res.json({
      success: true,
      message: 'Fund collection entry deleted',
      affectedRows: result.changes
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
