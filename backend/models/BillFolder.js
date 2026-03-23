// BillFolder Model
const db = require('../database/init');

const BillFolder = {
  /**
   * Create a new bill folder
   */
  async createFolder(data) {
    const { event_id, folder_name, description, created_by } = data;

    const query = `
      INSERT INTO bill_folders (event_id, folder_name, description, created_by)
      VALUES (?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [event_id, folder_name, description, created_by], (err, result) => {
        if (err) reject(err);
        else resolve({ success: true, id: result.insertId, ...data });
      });
    });
  },

  /**
   * Get all folders for an event
   */
  async getFoldersByEvent(eventId) {
    const query = `
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
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [eventId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  },

  /**
   * Get folder details with expenses
   */
  async getFolderWithExpenses(folderId) {
    const folderQuery = `
      SELECT 
        bf.*,
        u.name as created_by_name
      FROM bill_folders bf
      LEFT JOIN users u ON bf.created_by = u.id
      WHERE bf.id = ?
    `;

    const expensesQuery = `
      SELECT 
        e.*,
        u2.name as created_by_name
      FROM expenses e
      LEFT JOIN users u2 ON e.created_by = u2.id
      WHERE e.folder_id = ?
      ORDER BY e.created_at DESC
    `;

    return new Promise((resolve, reject) => {
      db.query(folderQuery, [folderId], (err, folders) => {
        if (err) return reject(err);
        if (folders.length === 0) return resolve(null);

        db.query(expensesQuery, [folderId], (err, expenses) => {
          if (err) return reject(err);
          resolve({
            ...folders[0],
            expenses: expenses,
            expense_count: expenses.length,
            folder_total: expenses.reduce((sum, e) => sum + (e.grand_total || 0), 0)
          });
        });
      });
    });
  },

  /**
   * Update folder
   */
  async updateFolder(folderId, data) {
    const { folder_name, description } = data;

    const query = `
      UPDATE bill_folders 
      SET folder_name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [folder_name, description, folderId], (err, result) => {
        if (err) reject(err);
        else resolve({ success: true, affectedRows: result.affectedRows });
      });
    });
  },

  /**
   * Delete folder
   */
  async deleteFolder(folderId) {
    const query = `DELETE FROM bill_folders WHERE id = ?`;

    return new Promise((resolve, reject) => {
      db.query(query, [folderId], (err, result) => {
        if (err) reject(err);
        else resolve({ success: true, affectedRows: result.affectedRows });
      });
    });
  },

  /**
   * Check if folder belongs to event
   */
  async verifyFolderBelongsToEvent(folderId, eventId) {
    const query = `SELECT id FROM bill_folders WHERE id = ? AND event_id = ?`;

    return new Promise((resolve, reject) => {
      db.query(query, [folderId, eventId], (err, results) => {
        if (err) reject(err);
        else resolve(results.length > 0);
      });
    });
  }
};

module.exports = BillFolder;
