// Expense Model
const db = require('../database/init');

const Expense = {
  /**
   * Add a new expense
   */
  async addExpense(data) {
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

    const query = `
      INSERT INTO expenses (
        event_id, folder_id, expense_title, category,
        transport_from, transport_to, transport_mode,
        fuel_amount, breakfast_amount, lunch_amount, 
        dinner_amount, refreshment_amount, accommodation_amount,
        other_expense, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [
        event_id, folder_id, expense_title, category,
        transport_from, transport_to, transport_mode,
        fuel_amount || 0, breakfast_amount || 0, lunch_amount || 0,
        dinner_amount || 0, refreshment_amount || 0, accommodation_amount || 0,
        other_expense || 0, created_by
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ success: true, id: result.insertId });
      });
    });
  },

  /**
   * Get expenses by folder
   */
  async getExpensesByFolder(folderId) {
    const query = `
      SELECT 
        e.*,
        u.name as created_by_name
      FROM expenses e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.folder_id = ?
      ORDER BY e.created_at DESC
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [folderId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  },

  /**
   * Get all expenses for an event
   */
  async getExpensesByEvent(eventId) {
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

    return new Promise((resolve, reject) => {
      db.query(query, [eventId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  },

  /**
   * Get folder summary
   */
  async getFolderSummary(folderId) {
    const query = `
      SELECT 
        COUNT(*) as expense_count,
        SUM(grand_total) as total_amount,
        SUM(food_total) as food_subtotal,
        SUM(travel_total) as travel_subtotal,
        SUM(accommodation_amount) as accommodation_subtotal,
        SUM(other_expense) as other_subtotal
      FROM expenses
      WHERE folder_id = ?
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [folderId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
  },

  /**
   * Get total expenses for an event
   */
  async getTotalExpenses(eventId) {
    const query = `
      SELECT COALESCE(SUM(grand_total), 0) as total_amount
      FROM expenses
      WHERE event_id = ?
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [eventId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
  },

  /**
   * Get expenses by category
   */
  async getExpensesByCategory(eventId) {
    const query = `
      SELECT 
        category,
        COUNT(*) as count,
        SUM(grand_total) as total
      FROM expenses
      WHERE event_id = ?
      GROUP BY category
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
