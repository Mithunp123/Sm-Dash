// Settings Model
const db = require('../database/init');

const Settings = {
  /**
   * Get a setting by key
   */
  async getSetting(key) {
    const query = `SELECT * FROM settings WHERE setting_key = ?`;

    return new Promise((resolve, reject) => {
      db.query(query, [key], (err, results) => {
        if (err) reject(err);
        else resolve(results[0] || null);
      });
    });
  },

  /**
   * Get all settings
   */
  async getAllSettings() {
    const query = `SELECT * FROM settings`;

    return new Promise((resolve, reject) => {
      db.query(query, [], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  },

  /**
   * Update a setting
   */
  async updateSetting(key, value, userId) {
    const query = `
      INSERT INTO settings (setting_key, setting_value, updated_by)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        setting_value = ?, 
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
    `;

    return new Promise((resolve, reject) => {
      db.query(query, [key, value, userId, value, userId], (err, result) => {
        if (err) reject(err);
        else resolve({ success: true, key, value });
      });
    });
  },

  /**
   * Check if fundraising is enabled
   */
  async isFundraisingEnabled() {
    const query = `SELECT setting_value FROM settings WHERE setting_key = 'fundraising_enabled'`;

    return new Promise((resolve, reject) => {
      db.query(query, [], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]?.setting_value === 'true' || false);
      });
    });
  },

  /**
   * Get QR code path
   */
  async getQRCodePath() {
    const query = `SELECT setting_value FROM settings WHERE setting_key = 'qr_code_path'`;

    return new Promise((resolve, reject) => {
      db.query(query, [], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]?.setting_value || '');
      });
    });
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

module.exports = Settings;
