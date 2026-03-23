// FundCollection Model
const db = require('../database/init');

const FundCollection = {
  /**
   * Add a new fund collection entry
   */
  async addCollection(data) {
    const {
      event_id,
      payer_name,
      amount,
      department,
      contributor_type,
      payment_mode,
      transaction_id,
      received_by,
      notes
    } = data;

    const query = `
      INSERT INTO fund_collections (
        event_id, payer_name, amount, department, 
        contributor_type, payment_mode, transaction_id, 
        received_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [
        event_id, payer_name, amount, department,
        contributor_type, payment_mode, transaction_id,
        received_by, notes
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ success: true, id: result.insertId, ...data });
      });
    });
  },

  /**
   * Get all collections for an event
   */
  async getCollectionsByEvent(eventId, filters = {}) {
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

    return new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  },

  /**
   * Get collection summary for an event
   */
  async getCollectionSummary(eventId) {
    const query = `
      SELECT 
        COUNT(*) as total_entries,
        SUM(amount) as total_amount,
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
