// FundCollection Model (ES Module)
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

export const FundCollection = {
  /**
   * Add a new fund collection entry
   */
  async addCollection(data) {
    try {
      const {
        event_id,
        payer_name,
        department,
        amount,
        payment_mode,
        received_by
      } = data;

      if (!event_id || !payer_name || amount === undefined || amount === null || !payment_mode || !received_by) {
        throw new Error('Missing required fields: event_id, payer_name, amount, payment_mode, received_by');
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('amount must be a positive number');
      }

      if (!['cash', 'upi'].includes(payment_mode)) {
        throw new Error('payment_mode must be either "cash" or "upi"');
      }

      const db = getDatabase();
      const query = `
        INSERT INTO fund_collections (
          event_id, payer_name, department, amount, payment_mode, received_by, entry_date
        ) VALUES (?, ?, ?, ?, ?, ?, CURDATE())
      `;

      const result = await run(db, query, [
        event_id, payer_name, department || null, parsedAmount, payment_mode, received_by
      ]);

      return { success: true, id: result.lastID, ...data };
    } catch (error) {
      throw new Error(`Failed to add collection: ${error.message}`);
    }
  },

  /**
   * Get all collections for an event
   */
  async getCollectionsByEvent(eventId, filters = {}) {
    try {
      if (!eventId) throw new Error('eventId is required');

      const db = getDatabase();
      let query = `
        SELECT 
          fc.*,
          u.name as received_by_name,
          u.email as received_by_email
        FROM fund_collections fc
        LEFT JOIN users u ON fc.received_by = u.id
        WHERE fc.event_id = ?
      `;

      const params = [eventId];

      // Apply filters
      if (filters.payment_mode) {
        query += ` AND fc.payment_mode = ?`;
        params.push(filters.payment_mode);
      }

      if (filters.start_date && filters.end_date) {
        query += ` AND DATE(fc.created_at) BETWEEN ? AND ?`;
        params.push(filters.start_date, filters.end_date);
      }

      if (filters.received_by) {
        query += ` AND fc.received_by = ?`;
        params.push(filters.received_by);
      }

      query += ` ORDER BY fc.created_at DESC`;

      const results = await all(db, query, params);
      return results || [];
    } catch (error) {
      throw new Error(`Failed to get collections: ${error.message}`);
    }
  },

  /**
   * Get collection summary for an event
   */
  async getCollectionSummary(eventId) {
    try {
      if (!eventId) throw new Error('eventId is required');

      const db = getDatabase();
      const query = `
        SELECT 
          COUNT(*) as total_entries,
          COALESCE(SUM(amount), 0) as total_amount,
          payment_mode,
          DATE(created_at) as collection_date,
          received_by,
          u.name as received_by_name
        FROM fund_collections fc
        LEFT JOIN users u ON fc.received_by = u.id
        WHERE fc.event_id = ?
        GROUP BY DATE(created_at), payment_mode, received_by
        ORDER BY collection_date DESC
      `;

      const results = await all(db, query, [eventId]);
      return results || [];
    } catch (error) {
      throw new Error(`Failed to get summary: ${error.message}`);
    }
  },

  /**
   * Get total collections for an event
   */
  async getTotalCollections(eventId) {
    try {
      if (!eventId) throw new Error('eventId is required');

      const db = getDatabase();
      const query = `
        SELECT COALESCE(SUM(amount), 0) as total_amount
        FROM fund_collections
        WHERE event_id = ?
      `;

      const result = await get(db, query, [eventId]);
      return result?.total_amount || 0;
    } catch (error) {
      throw new Error(`Failed to get total: ${error.message}`);
    }
  },

  /**
   * Get collection by ID
   */
  async getCollectionById(collectionId) {
    try {
      if (!collectionId) throw new Error('collectionId is required');

      const db = getDatabase();
      const query = `
        SELECT 
          fc.*,
          u.name as received_by_name,
          u.email as received_by_email
        FROM fund_collections fc
        LEFT JOIN users u ON fc.received_by = u.id
        WHERE fc.id = ?
      `;

      return await get(db, query, [collectionId]);
    } catch (error) {
      throw new Error(`Failed to get collection: ${error.message}`);
    }
  },

  /**
   * Update collection
   */
  async updateCollection(collectionId, data) {
    try {
      const { payer_name, department, amount, payment_mode } = data;
      const db = getDatabase();

      const query = `
        UPDATE fund_collections SET
          payer_name = ?,
          department = ?,
          amount = ?,
          payment_mode = ?,
          updated_at = NOW()
        WHERE id = ?
      `;

      const result = await run(db, query, [payer_name, department || null, amount, payment_mode, collectionId]);
      return { success: result.changes > 0 };
    } catch (error) {
      throw new Error(`Failed to update collection: ${error.message}`);
    }
  },

  /**
   * Delete collection
   */
  async deleteCollection(collectionId) {
    try {
      if (!collectionId) throw new Error('collectionId is required');

      const db = getDatabase();
      const query = `DELETE FROM fund_collections WHERE id = ?`;

      const result = await run(db, query, [collectionId]);
      return { success: result.changes > 0 };
    } catch (error) {
      throw new Error(`Failed to delete collection: ${error.message}`);
    }
  },

  /**
   * Get collections by received_by user
   */
  async getCollectionsByReceivedBy(userId, eventId) {
    try {
      if (!userId || !eventId) throw new Error('userId and eventId are required');

      const db = getDatabase();
      const query = `
        SELECT * FROM fund_collections
        WHERE received_by = ? AND event_id = ?
        ORDER BY created_at DESC
      `;

      const results = await all(db, query, [userId, eventId]);
      return results || [];
    } catch (error) {
      throw new Error(`Failed to get collections: ${error.message}`);
    }
  }
};

export default FundCollection;

    return new Promise((resolve, reject) => {
      db.query(query, [eventId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  },

  /**
   * Get user-wise contribution summary
   */
  async getUserWiseContribution(eventId) {
    const query = `
      SELECT 
        received_by,
        u.name,
        COUNT(*) as total_entries,
        SUM(amount) as total_contributed
      FROM fund_collections fc
      LEFT JOIN users u ON fc.received_by = u.id
      WHERE fc.event_id = ?
      GROUP BY received_by
      ORDER BY total_contributed DESC
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [eventId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  },

  /**
   * Get total fund raised for an event
   */
  async getTotalFundRaised(eventId) {
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total_amount
      FROM fund_collections
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
   * Delete a fund collection entry (Admin only)
   */
  async deleteCollection(collectionId) {
    const query = `DELETE FROM fund_collections WHERE id = ?`;

    return new Promise((resolve, reject) => {
      db.query(query, [collectionId], (err, result) => {
        if (err) reject(err);
        else resolve({ success: true, affectedRows: result.affectedRows });
      });
    });
  },

  /**
   * Get daily collection totals
   */
  async getDailyCollectionTotals(eventId) {
    const query = `
      SELECT 
        DATE(created_at) as collection_date,
        COUNT(*) as entry_count,
        SUM(amount) as daily_total,
        SUM(CASE WHEN payment_mode = 'cash' THEN amount ELSE 0 END) as cash_total,
        SUM(CASE WHEN payment_mode = 'online' THEN amount ELSE 0 END) as online_total
      FROM fund_collections
      WHERE event_id = ?
      GROUP BY DATE(created_at)
      ORDER BY collection_date DESC
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [eventId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }
};

module.exports = FundCollection;
