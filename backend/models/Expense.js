// Expense Model (ES Module)
import { getDatabase } from '../database/init.js';

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
      else resolve(rows || []);
    });
  });
};

// Helper to calculate totals
const calculateTotals = (expenseData) => {
  const food_total = 
    (parseFloat(expenseData.breakfast_amount) || 0) +
    (parseFloat(expenseData.lunch_amount) || 0) +
    (parseFloat(expenseData.dinner_amount) || 0) +
    (parseFloat(expenseData.refreshment_amount) || 0);

  const travel_total = (parseFloat(expenseData.fuel_amount) || 0);
  
  const accommodation_total = (parseFloat(expenseData.accommodation_amount) || 0);
  
  const grand_total = food_total + travel_total + accommodation_total + (parseFloat(expenseData.other_expense) || 0);

  return { food_total, travel_total, grand_total };
};

export const Expense = {
  /**
   * Add a new expense
   */
  async addExpense(data) {
    try {
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
        other_expense,
        created_by
      } = data;

      if (!event_id || !folder_id || !expense_title || !created_by) {
        throw new Error('Missing required fields: event_id, folder_id, expense_title, created_by');
      }

      const { food_total, travel_total, grand_total } = calculateTotals(data);

      const db = getDatabase();
      const query = `
        INSERT INTO expenses (
          event_id, folder_id, expense_title, category,
          transport_from, transport_to, transport_mode,
          fuel_amount, breakfast_amount, lunch_amount, 
          dinner_amount, refreshment_amount, accommodation_amount,
          other_expense, food_total, travel_total, grand_total, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await run(db, query, [
        event_id, folder_id, expense_title, category || 'other',
        transport_from || null, transport_to || null, transport_mode || null,
        fuel_amount || 0, breakfast_amount || 0, lunch_amount || 0,
        dinner_amount || 0, refreshment_amount || 0, accommodation_amount || 0,
        other_expense || 0, food_total, travel_total, grand_total, created_by
      ]);

      return { success: true, id: result.lastID, ...data, food_total, travel_total, grand_total };
    } catch (error) {
      throw new Error(`Failed to add expense: ${error.message}`);
    }
  },

  /**
   * Get expenses by folder
   */
  async getExpensesByFolder(folderId) {
    try {
      if (!folderId) throw new Error('folderId is required');

      const db = getDatabase();
      const query = `
        SELECT 
          e.*,
          u.name as created_by_name
        FROM expenses e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.folder_id = ?
        ORDER BY e.created_at DESC
      `;

      const results = await all(db, query, [folderId]);
      return results || [];
    } catch (error) {
      throw new Error(`Failed to get expenses: ${error.message}`);
    }
  },

  /**
   * Get all expenses for an event
   */
  async getExpensesByEvent(eventId) {
    try {
      if (!eventId) throw new Error('eventId is required');

      const db = getDatabase();
      const query = `
        SELECT 
          e.*,
          bf.folder_name,
          u.name as created_by_name
        FROM expenses e
        LEFT JOIN bill_folders bf ON e.folder_id = bf.id
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.event_id = ?
        ORDER BY e.created_at DESC
      `;

      const results = await all(db, query, [eventId]);
      return results || [];
    } catch (error) {
      throw new Error(`Failed to get expenses: ${error.message}`);
    }
  },

  /**
   * Get expense by ID
   */
  async getExpenseById(expenseId) {
    try {
      if (!expenseId) throw new Error('expenseId is required');

      const db = getDatabase();
      const query = `
        SELECT 
          e.*,
          bf.folder_name,
          u.name as created_by_name
        FROM expenses e
        LEFT JOIN bill_folders bf ON e.folder_id = bf.id
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.id = ?
      `;

      return await get(db, query, [expenseId]);
    } catch (error) {
      throw new Error(`Failed to get expense: ${error.message}`);
    }
  },

  /**
   * Update expense
   */
  async updateExpense(expenseId, data) {
    try {
      const { food_total, travel_total, grand_total } = calculateTotals(data);

      const db = getDatabase();
      const query = `
        UPDATE expenses SET
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
          food_total = ?,
          travel_total = ?,
          grand_total = ?,
          updated_at = NOW()
        WHERE id = ?
      `;

      const result = await run(db, query, [
        data.expense_title,
        data.category || 'other',
        data.transport_from || null,
        data.transport_to || null,
        data.transport_mode || null,
        data.fuel_amount || 0,
        data.breakfast_amount || 0,
        data.lunch_amount || 0,
        data.dinner_amount || 0,
        data.refreshment_amount || 0,
        data.accommodation_amount || 0,
        data.other_expense || 0,
        food_total,
        travel_total,
        grand_total,
        expenseId
      ]);

      return { success: result.changes > 0 };
    } catch (error) {
      throw new Error(`Failed to update expense: ${error.message}`);
    }
  },

  /**
   * Delete expense
   */
  async deleteExpense(expenseId) {
    try {
      if (!expenseId) throw new Error('expenseId is required');

      const db = getDatabase();
      const query = `DELETE FROM expenses WHERE id = ?`;

      const result = await run(db, query, [expenseId]);
      return { success: result.changes > 0 };
    } catch (error) {
      throw new Error(`Failed to delete expense: ${error.message}`);
    }
  },

  /**
   * Get folder summary
   */
  async getFolderSummary(folderId) {
    try {
      if (!folderId) throw new Error('folderId is required');

      const db = getDatabase();
      const query = `
        SELECT 
          COUNT(*) as expense_count,
          COALESCE(SUM(grand_total), 0) as total_amount,
          COALESCE(SUM(food_total), 0) as food_subtotal,
          COALESCE(SUM(travel_total), 0) as travel_subtotal,
          COALESCE(SUM(accommodation_amount), 0) as accommodation_subtotal,
          COALESCE(SUM(other_expense), 0) as other_subtotal
        FROM expenses
        WHERE folder_id = ?
      `;

      return await get(db, query, [folderId]);
    } catch (error) {
      throw new Error(`Failed to get summary: ${error.message}`);
    }
  },

  /**
   * Get total expenses for an event
   */
  async getTotalExpenses(eventId) {
    try {
      if (!eventId) throw new Error('eventId is required');

      const db = getDatabase();
      const query = `
        SELECT COALESCE(SUM(grand_total), 0) as total_amount
        FROM expenses
        WHERE event_id = ?
      `;

      const result = await get(db, query, [eventId]);
      return result?.total_amount || 0;
    } catch (error) {
      throw new Error(`Failed to get total: ${error.message}`);
    }
  }
};

export default Expense;
      ORDER BY total DESC
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [eventId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  },

  /**
   * Delete an expense
   */
  async deleteExpense(expenseId) {
    const query = `DELETE FROM expenses WHERE id = ?`;

    return new Promise((resolve, reject) => {
      db.query(query, [expenseId], (err, result) => {
        if (err) reject(err);
        else resolve({ success: true, affectedRows: result.affectedRows });
      });
    });
  },

  /**
   * Update an expense
   */
  async updateExpense(expenseId, data) {
    const {
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
    } = data;

    const query = `
      UPDATE expenses SET
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
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [
        expense_title,
        category,
        transport_from,
        transport_to,
        transport_mode,
        fuel_amount || 0,
        breakfast_amount || 0,
        lunch_amount || 0,
        dinner_amount || 0,
        refreshment_amount || 0,
        accommodation_amount || 0,
        other_expense || 0,
        expenseId
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ success: true, affectedRows: result.affectedRows });
      });
    });
  }
};

module.exports = Expense;
