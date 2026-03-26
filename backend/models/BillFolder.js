// BillFolder Model (ES Module)
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

export const BillFolder = {
  /**
   * Create a new bill folder
   */
  async createFolder(data) {
    try {
      const { event_id, folder_name, description, created_by } = data;

      if (!event_id || !folder_name) {
        throw new Error('event_id and folder_name are required');
      }

      const db = getDatabase();
      const query = `
        INSERT INTO bill_folders (event_id, folder_name, description, created_by)
        VALUES (?, ?, ?, ?)
      `;

      const result = await run(db, query, [event_id, folder_name, description || '', created_by]);
      return { success: true, id: result.lastID, ...data };
    } catch (error) {
      throw new Error(`Failed to create folder: ${error.message}`);
    }
  },

  /**
   * Get all folders for an event
   */
  async getFoldersByEvent(eventId) {
    try {
      if (!eventId) throw new Error('eventId is required');

      const db = getDatabase();
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

      const results = await all(db, query, [eventId]);
      return results || [];
    } catch (error) {
      throw new Error(`Failed to get folders: ${error.message}`);
    }
  },

  /**
   * Get folder details
   */
  async getFolderById(folderId) {
    try {
      if (!folderId) throw new Error('folderId is required');

      const db = getDatabase();
      const query = `
        SELECT 
          bf.*,
          u.name as created_by_name,
          COUNT(e.id) as expense_count,
          COALESCE(SUM(e.grand_total), 0) as folder_total
        FROM bill_folders bf
        LEFT JOIN users u ON bf.created_by = u.id
        LEFT JOIN expenses e ON bf.id = e.folder_id
        WHERE bf.id = ?
        GROUP BY bf.id
      `;

      return await get(db, query, [folderId]);
    } catch (error) {
      throw new Error(`Failed to get folder: ${error.message}`);
    }
  },

  /**
   * Update folder
   */
  async updateFolder(folderId, data) {
    try {
      const { folder_name, description } = data;
      const db = getDatabase();

      const query = `
        UPDATE bill_folders
        SET folder_name = ?, description = ?, updated_at = NOW()
        WHERE id = ?
      `;

      const result = await run(db, query, [folder_name, description, folderId]);
      return { success: result.changes > 0 };
    } catch (error) {
      throw new Error(`Failed to update folder: ${error.message}`);
    }
  },

  /**
   * Delete folder (cascades to expenses)
   */
  async deleteFolder(folderId) {
    try {
      if (!folderId) throw new Error('folderId is required');

      const db = getDatabase();
      const query = `DELETE FROM bill_folders WHERE id = ?`;

      const result = await run(db, query, [folderId]);
      return { success: result.changes > 0 };
    } catch (error) {
      throw new Error(`Failed to delete folder: ${error.message}`);
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
      throw new Error(`Failed to get folder summary: ${error.message}`);
    }
  }
};

export default BillFolder;
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
