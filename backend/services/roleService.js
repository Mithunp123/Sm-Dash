/**
 * Role Service - Manages office bearer roles and permissions
 * Provides core functionality for role-based access control
 */

const db = require('../database');
const logger = require('../utils/logger');

class RoleService {
  /**
   * Get the effective role of a user
   * Returns the office bearer position if assigned, otherwise 'student'
   * 
   * @param {number} userId - User ID
   * @returns {Promise<string>} Effective role (e.g., 'Secretary', 'student')
   */
  static async getEffectiveRole(userId) {
    try {
      if (!userId) return 'student';

      const [results] = await db.query(
        `SELECT position FROM office_bearers 
         WHERE user_id = ? AND is_active = 1 LIMIT 1`,
        [userId]
      );

      if (results.length > 0) {
        logger.debug(`[RoleService] User ${userId} has role: ${results[0].position}`);
        return results[0].position; // e.g., 'Secretary', 'President'
      }

      return 'student'; // Default role
    } catch (error) {
      logger.error(`[RoleService] Failed to get effective role for user ${userId}:`, error);
      return 'student'; // Safe default on error
    }
  }

  /**
   * Get all active office bearer assignments
   * 
   * @returns {Promise<Array>} Array of office bearer objects with user details
   */
  static async getAllOfficeBearers() {
    try {
      const [results] = await db.query(`
        SELECT 
          ob.id,
          ob.position,
          ob.user_id,
          ob.assigned_date,
          ob.term_end_date,
          u.name,
          u.email,
          u.photo_url
        FROM office_bearers ob
        LEFT JOIN users u ON ob.user_id = u.id
        WHERE ob.is_active = 1
        ORDER BY FIELD(ob.position, 
          'President', 'Vice President', 'Secretary', 'Joint Secretary', 
          'Treasurer', 'Joint Treasurer')
      `);
      
      logger.info(`[RoleService] Fetched ${results.length} active office bearers`);
      return results;
    } catch (error) {
      logger.error('[RoleService] Failed to fetch office bearers:', error);
      throw new Error('Failed to fetch office bearers');
    }
  }

  /**
   * Get office bearer by user ID
   * 
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Office bearer object or null
   */
  static async getOfficeBearerByUser(userId) {
    try {
      const [results] = await db.query(
        `SELECT * FROM office_bearers WHERE user_id = ? AND is_active = 1 LIMIT 1`,
        [userId]
      );

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error(`[RoleService] Failed to get office bearer for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get office bearer by position
   * 
   * @param {string} position - Position name (e.g., 'Secretary')
   * @returns {Promise<Object|null>} Office bearer object or null
   */
  static async getOfficeBearerByPosition(position) {
    try {
      const [results] = await db.query(
        `SELECT * FROM office_bearers WHERE position = ? AND is_active = 1 LIMIT 1`,
        [position]
      );

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error(`[RoleService] Failed to get office bearer for position ${position}:`, error);
      return null;
    }
  }

  /**
   * Validate position is valid
   * 
   * @param {string} position - Position to validate
   * @returns {boolean} True if valid
   */
  static isValidPosition(position) {
    const validPositions = [
      'President', 'Vice President', 'Secretary', 'Joint Secretary',
      'Treasurer', 'Joint Treasurer'
    ];
    return validPositions.includes(position);
  }

  /**
   * Assign an office bearer role to a user
   * Validates: no duplicate roles + user doesn't already have a role
   * Transaction: atomic operation
   * 
   * @param {number} userId - User ID to assign
   * @param {string} position - Position to assign (must be valid)
   * @returns {Promise<Object>} New office bearer record
   * @throws {Error} If validation fails
   */
  static async assignRole(userId, position) {
    let connection;

    try {
      // Validate input
      if (!userId || !position) {
        throw new Error('User ID and position are required');
      }

      if (!this.isValidPosition(position)) {
        throw new Error(`Invalid position: ${position}`);
      }

      // Get database connection for transaction
      connection = await db.getConnection();
      await connection.beginTransaction();

      // Check if role is already assigned to another user
      const [existingRole] = await connection.query(
        `SELECT user_id FROM office_bearers WHERE position = ? AND is_active = 1`,
        [position]
      );

      if (existingRole.length > 0) {
        throw new Error(
          `${position} is already assigned to user ${existingRole[0].user_id}. ` +
          `Remove existing assignment first.`
        );
      }

      // Check if user already has an active role
      const [userRoles] = await connection.query(
        `SELECT position FROM office_bearers WHERE user_id = ? AND is_active = 1`,
        [userId]
      );

      if (userRoles.length > 0) {
        throw new Error(
          `User ${userId} already has role: ${userRoles[0].position}. ` +
          `Remove existing role first.`
        );
      }

      // Verify user exists
      const [userExists] = await connection.query(
        `SELECT id FROM users WHERE id = ? LIMIT 1`,
        [userId]
      );

      if (userExists.length === 0) {
        throw new Error(`User ${userId} not found`);
      }

      // Insert new office bearer record
      const [result] = await connection.query(
        `INSERT INTO office_bearers (user_id, position) VALUES (?, ?)`,
        [userId, position]
      );

      // Update user's role field (denormalization for quick queries)
      await connection.query(
        `UPDATE users SET role = 'office_bearer' WHERE id = ?`,
        [userId]
      );

      await connection.commit();

      logger.info(`[RoleService] ✅ Assigned ${position} to user ${userId}`);

      return {
        id: result.insertId,
        user_id: userId,
        position,
        assigned_date: new Date().toISOString()
      };

    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      logger.error(`[RoleService] Failed to assign role:`, error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * Update an office bearer's role or remove it
   * Transaction: atomic operation
   * 
   * @param {number} bearerId - Office bearer ID
   * @param {string|null} newPosition - New position or null to remove
   * @returns {Promise<Object>} Success response
   * @throws {Error} If validation fails
   */
  static async updateRole(bearerId, newPosition) {
    let connection;

    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // Get current assignment
      const [current] = await connection.query(
        `SELECT user_id, position FROM office_bearers WHERE id = ?`,
        [bearerId]
      );

      if (current.length === 0) {
        throw new Error('Office bearer not found');
      }

      const userId = current[0].user_id;
      const oldPosition = current[0].position;

      if (newPosition === null) {
        // Remove role - revert user to student
        await connection.query(
          `UPDATE office_bearers SET is_active = 0 WHERE id = ?`,
          [bearerId]
        );

        await connection.query(
          `UPDATE users SET role = 'student' WHERE id = ?`,
          [userId]
        );

        await connection.commit();
        logger.info(`[RoleService] ✅ Removed ${oldPosition} from user ${userId}`);

        return { success: true, message: `${oldPosition} role removed` };
      }

      // Validate new position
      if (!this.isValidPosition(newPosition)) {
        throw new Error(`Invalid position: ${newPosition}`);
      }

      // Check if new position is available
      const [taken] = await connection.query(
        `SELECT user_id FROM office_bearers 
         WHERE position = ? AND id != ? AND is_active = 1`,
        [newPosition, bearerId]
      );

      if (taken.length > 0) {
        throw new Error(`${newPosition} is already assigned to user ${taken[0].user_id}`);
      }

      // Update position
      await connection.query(
        `UPDATE office_bearers SET position = ?, updated_at = NOW() WHERE id = ?`,
        [newPosition, bearerId]
      );

      await connection.commit();
      logger.info(`[RoleService] ✅ Updated user ${userId} from ${oldPosition} to ${newPosition}`);

      return { 
        success: true, 
        message: `Role updated from ${oldPosition} to ${newPosition}` 
      };

    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      logger.error(`[RoleService] Failed to update role:`, error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * Permission level hierarchy
   * 'view' (1) -> 'create' (2) -> 'edit' (3) -> 'delete' (4)
   * 
   * @param {string} level - Permission level string
   * @returns {number} Numeric representation (0 if invalid)
   */
  static getPermissionLevel(level) {
    const levels = {
      'view': 1,
      'create': 2,
      'edit': 3,
      'delete': 4
    };
    return levels[level] || 0;
  }

  /**
   * Check if user has permission for a specific action on a feature
   * Supports 'all' permission which grants access to everything
   * 
   * @param {number} userId - User ID
   * @param {string} feature - Feature name (e.g., 'finance', 'people')
   * @param {string} action - Action type ('view', 'create', 'edit', 'delete')
   * @returns {Promise<boolean>} True if user has permission
   */
  static async hasPermission(userId, feature, action = 'view') {
    try {
      if (!userId || !feature) {
        logger.warn('[RoleService] Missing userId or feature in hasPermission check');
        return false;
      }

      // Get user's effective role
      const role = await this.getEffectiveRole(userId);

      // Check for 'all' permission (super admin actions)
      const [allPermissions] = await db.query(
        `SELECT permission_level FROM role_permissions 
         WHERE position = ? AND feature = 'all' LIMIT 1`,
        [role]
      );

      if (allPermissions.length > 0) {
        const maxPerm = this.getPermissionLevel(allPermissions[0].permission_level);
        const actionPerm = this.getPermissionLevel(action);
        
        if (maxPerm >= actionPerm) {
          logger.debug(`[RoleService] User ${userId} (${role}) has 'all' permission for ${action}`);
          return true;
        }
      }

      // Check specific feature permission
      const [featurePermissions] = await db.query(
        `SELECT permission_level FROM role_permissions 
         WHERE position = ? AND feature = ? LIMIT 1`,
        [role, feature]
      );

      if (featurePermissions.length === 0) {
        logger.debug(`[RoleService] User ${userId} (${role}) has NO permission for ${feature}`);
        return false;
      }

      const permLevel = this.getPermissionLevel(featurePermissions[0].permission_level);
      const actionLevel = this.getPermissionLevel(action);
      const hasAccess = permLevel >= actionLevel;

      logger.debug(
        `[RoleService] User ${userId} (${role}) ${hasAccess ? 'HAS' : 'DENIED'} ` +
        `${action} access to ${feature}`
      );

      return hasAccess;

    } catch (error) {
      logger.error(
        `[RoleService] Error checking permission for user ${userId} on ${feature}:${action}`,
        error
      );
      return false; // Deny by default on error
    }
  }

  /**
   * Get all permissions for a user's role
   * 
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of permission objects
   */
  static async getUserPermissions(userId) {
    try {
      const role = await this.getEffectiveRole(userId);

      const [permissions] = await db.query(
        `SELECT feature, permission_level, description FROM role_permissions 
         WHERE position = ? ORDER BY feature ASC`,
        [role]
      );

      return permissions;
    } catch (error) {
      logger.error(`[RoleService] Failed to get permissions for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Log activity (for audit trail)
   * 
   * @param {number} userId - User ID performing action
   * @param {string} action - Action name
   * @param {string} entityType - Type of entity (e.g., 'finance', 'user')
   * @param {number} entityId - ID of entity
   * @param {Object} beforeValue - Data before change
   * @param {Object} afterValue - Data after change
   * @param {string} ipAddress - IP address of request
   */
  static async logActivity(userId, action, entityType, entityId, beforeValue, afterValue, ipAddress) {
    try {
      await db.query(
        `INSERT INTO activity_logs 
         (user_id, action, entity_type, entity_id, before_value, after_value, ip_address) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, action, entityType, entityId, JSON.stringify(beforeValue), JSON.stringify(afterValue), ipAddress]
      );

      logger.info(
        `[RoleService] Activity logged: User ${userId} ${action} on ${entityType}:${entityId}`
      );
    } catch (error) {
      logger.error('[RoleService] Failed to log activity:', error);
      // Don't throw - logging failures shouldn't break main flow
    }
  }
}

module.exports = RoleService;
