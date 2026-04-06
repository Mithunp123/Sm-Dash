/**
 * Office Bearer Routes
 * Management endpoints for office bearer roles and permissions
 * All endpoints require authentication and appropriate permissions
 */

const express = require('express');
const RoleService = require('../services/roleService');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireManageOfficeBearer } = require('../middleware/roleMiddleware');
const db = require('../database');
const logger = require('../utils/logger');

const router = express.Router();

// ============================================================================
// GET ENDPOINTS
// ============================================================================

/**
 * GET /api/office-bearers
 * Retrieve all active office bearer assignments
 * Permission: view office-bearers feature
 */
router.get(
  '/office-bearers',
  requireAuth,
  requirePermission('office-bearers', 'view'),
  async (req, res) => {
    try {
      logger.info(`[GET /office-bearers] User ${req.user.id} requesting office bearer list`);

      const bearers = await RoleService.getAllOfficeBearers();

      res.json({
        success: true,
        total: bearers.length,
        office_bearers: bearers
      });
    } catch (error) {
      logger.error('[GET /office-bearers] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch office bearers'
      });
    }
  }
);

/**
 * GET /api/office-bearers/:id
 * Retrieve specific office bearer assignment
 */
router.get(
  '/office-bearers/:id',
  requireAuth,
  requirePermission('office-bearers', 'view'),
  async (req, res) => {
    try {
      const bearerId = parseInt(req.params.id);

      if (isNaN(bearerId)) {
        return res.status(400).json({ success: false, error: 'Invalid bearer ID' });
      }

      const [results] = await db.query(
        `SELECT ob.*, u.name, u.email FROM office_bearers ob 
         LEFT JOIN users u ON ob.user_id = u.id 
         WHERE ob.id = ? AND ob.is_active = 1`,
        [bearerId]
      );

      if (results.length === 0) {
        return res.status(404).json({ success: false, error: 'Office bearer not found' });
      }

      res.json({
        success: true,
        office_bearer: results[0]
      });
    } catch (error) {
      logger.error('[GET /office-bearers/:id] Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/user/:userId/role
 * Get effective role for a specific user
 */
router.get(
  '/user/:userId/role',
  requireAuth,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: 'Invalid user ID' });
      }

      const effectiveRole = await RoleService.getEffectiveRole(userId);

      res.json({
        success: true,
        user_id: userId,
        effective_role: effectiveRole
      });
    } catch (error) {
      logger.error('[GET /user/:userId/role] Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/permissions/:userId
 * Get all permissions for a user's role
 */
router.get(
  '/permissions/:userId',
  requireAuth,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: 'Invalid user ID' });
      }

      const role = await RoleService.getEffectiveRole(userId);
      const permissions = await RoleService.getUserPermissions(userId);

      res.json({
        success: true,
        user_id: userId,
        effective_role: role,
        permissions: permissions
      });
    } catch (error) {
      logger.error('[GET /permissions/:userId] Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/roles
 * Get list of all available positions
 */
router.get(
  '/roles',
  requireAuth,
  async (req, res) => {
    try {
      const positions = [
        'President',
        'Vice President',
        'Secretary',
        'Joint Secretary',
        'Treasurer',
        'Joint Treasurer'
      ];

      res.json({
        success: true,
        positions: positions
      });
    } catch (error) {
      logger.error('[GET /roles] Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ============================================================================
// POST ENDPOINTS
// ============================================================================

/**
 * POST /api/office-bearers
 * Assign an office bearer role to a user
 * Permission: create office-bearers (only President/VP)
 * 
 * Body: {
 *   user_id: number,
 *   position: string ('President', 'Secretary', etc.)
 * }
 */
router.post(
  '/office-bearers',
  requireAuth,
  requirePermission('office-bearers', 'create'),
  async (req, res) => {
    try {
      const { user_id, position } = req.body;

      // Validate input
      if (!user_id || !position) {
        return res.status(400).json({
          success: false,
          error: 'user_id and position are required'
        });
      }

      logger.info(`[POST /office-bearers] User ${req.user.id} assigning ${position} to user ${user_id}`);

      // Call service to assign role
      const bearer = await RoleService.assignRole(user_id, position);

      // Log activity
      await RoleService.logActivity(
        req.user.id,
        'ASSIGNED_ROLE',
        'office_bearers',
        bearer.id,
        null,
        { position, user_id },
        req.ip
      );

      res.status(201).json({
        success: true,
        message: `${position} assigned to user ${user_id}`,
        office_bearer: bearer
      });
    } catch (error) {
      logger.error('[POST /office-bearers] Error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to assign role'
      });
    }
  }
);

// ============================================================================
// PUT ENDPOINTS
// ============================================================================

/**
 * PUT /api/office-bearers/:id
 * Update an office bearer role or remove it
 * Permission: edit office-bearers (only President/VP)
 * 
 * Body: {
 *   position: string | null  (null to remove role)
 * }
 */
router.put(
  '/office-bearers/:id',
  requireAuth,
  requirePermission('office-bearers', 'edit'),
  async (req, res) => {
    try {
      const bearerId = parseInt(req.params.id);
      const { position } = req.body;

      if (isNaN(bearerId)) {
        return res.status(400).json({ success: false, error: 'Invalid bearer ID' });
      }

      logger.info(`[PUT /office-bearers/:id] User ${req.user.id} updating bearer ${bearerId} to ${position}`);

      const result = await RoleService.updateRole(bearerId, position);

      // Log activity
      await RoleService.logActivity(
        req.user.id,
        position ? 'UPDATED_ROLE' : 'REMOVED_ROLE',
        'office_bearers',
        bearerId,
        null,
        { position },
        req.ip
      );

      res.json(result);
    } catch (error) {
      logger.error('[PUT /office-bearers/:id] Error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update role'
      });
    }
  }
);

// ============================================================================
// DELETE ENDPOINTS
// ============================================================================

/**
 * DELETE /api/office-bearers/:id
 * Remove an office bearer role (sets is_active = 0)
 * Permission: delete office-bearers (only President/VP)
 */
router.delete(
  '/office-bearers/:id',
  requireAuth,
  requirePermission('office-bearers', 'delete'),
  async (req, res) => {
    try {
      const bearerId = parseInt(req.params.id);

      if (isNaN(bearerId)) {
        return res.status(400).json({ success: false, error: 'Invalid bearer ID' });
      }

      logger.info(`[DELETE /office-bearers/:id] User ${req.user.id} removing bearer ${bearerId}`);

      const result = await RoleService.updateRole(bearerId, null);

      // Log activity
      await RoleService.logActivity(
        req.user.id,
        'DELETED_ROLE',
        'office_bearers',
        bearerId,
        null,
        null,
        req.ip
      );

      res.json(result);
    } catch (error) {
      logger.error('[DELETE /office-bearers/:id] Error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to remove role'
      });
    }
  }
);

module.exports = router;
