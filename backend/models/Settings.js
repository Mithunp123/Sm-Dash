// Settings Model
import { getDatabase } from '../database/init.js';

// Helper functions for database queries
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

const run = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const Settings = {
  /**
   * Get a setting by key
   */
  async getSetting(key) {
    const db = getDatabase();
    const query = `SELECT * FROM settings WHERE setting_key = ?`;
    const result = await get(db, query, [key]);
    return result || null;
  },

  /**
   * Get all settings
   */
  async getAllSettings() {
    const db = getDatabase();
    const query = `SELECT * FROM settings`;
    return await all(db, query, []);
  },

  /**
   * Update a setting
   */
  async updateSetting(key, value, userId) {
    const db = getDatabase();
    const query = `
      INSERT INTO settings (setting_key, setting_value, updated_by)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        setting_value = ?, 
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
    `;
    await run(db, query, [key, value, userId, value, userId]);
    return { success: true, key, value };
  },

  /**
   * Check if fundraising is enabled
   */
  async isFundraisingEnabled() {
    const db = getDatabase();
    const query = `SELECT setting_value FROM settings WHERE setting_key = 'fundraising_enabled'`;
    const result = await get(db, query, []);
    return result?.setting_value === 'true' || false;
  },

  /**
   * Get QR code path
   */
  async getQRCodePath() {
    const db = getDatabase();
    const query = `SELECT setting_value FROM settings WHERE setting_key = 'qr_code_path'`;
    const result = await get(db, query, []);
    return result?.setting_value || '';
  },

  /**
   * Toggle fundraising
   */
  async toggleFundraising(enabled, userId) {
    return this.updateSetting('fundraising_enabled', enabled ? 'true' : 'false', userId);
  },

  /**
   * Update QR code path
   */
  async updateQRCodePath(path, userId) {
    return this.updateSetting('qr_code_path', path, userId);
  }
};

export default Settings;
