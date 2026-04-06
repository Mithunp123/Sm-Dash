/**
 * Role-Based Access Control Middleware
 * Provides permission checking and role validation
 */

const RoleService = require('../services/roleService');
const logger = require('../utils/logger');

/**
 * Middleware: Attach effective role to request object
 * Should be called after authentication middleware
 * Adds: req.effectiveRole
 */
async function attachEffectiveRole(req, res, next) {
  try {
    if (!req.user) {
      return next(); // No user, skip
    }

    req.effectiveRole = await RoleService.getEffectiveRole(req.user.id);
    logger.debug(`[attachEffectiveRole] User ${req.user.id} has role: ${req.effectiveRole}`);

    next();
  } catch (error) {
    logger.error('[attachEffectiveRole] Error:', error);
    // Default to student role on error
    req.effectiveRole = 'student';
    next();
  }
}

/**
 * Middleware: Require authentication AND specific permission
 * Usage: router.get('/finance', requireAuth, requirePermission('finance', 'view'), handler)
 * 
 * @param {string} feature - Feature name (e.g., 'finance', 'people', 'office-bearers')
 * @param {string} action - Action type ('view', 'create', 'edit', 'delete')
 * @returns {Function} Express middleware function
 */
function requirePermission(feature, action = 'view') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        logger.warn(`[requirePermission] Unauthenticated access attempt to ${feature}:${action}`);
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const hasAccess = await RoleService.hasPermission(req.user.id, feature, action);

      if (!hasAccess) {
        logger.warn(
          `[requirePermission] DENIED: User ${req.user.id} (${req.effectiveRole}) ` +
          `tried to access ${feature}:${action}`
        );

        // Log to activity logs
        try {
          await RoleService.logActivity(
            req.user.id,
            `DENIED_ACCESS_${action.toUpperCase()}`,
            feature,
            null,
            null,
            null,
            req.ip
          );
        } catch (e) {
          // Silently fail - don't interrupt the response
        }

        return res.status(403).json({
          success: false,
          error: `You do not have ${action} permission for ${feature}`
        });
      }

      logger.debug(
        `[requirePermission] ALLOWED: User ${req.user.id} (${req.effectiveRole}) ` +
        `accessing ${feature}:${action}`
      );

      next();
    } catch (error) {
      logger.error('[requirePermission] Error checking permission:', error);
      return res.status(500).json({
        success: false,
        error: 'Permission check failed'
      });
    }
  };
}

/**
 * Middleware: Require user to be a super admin (President or Vice President)
 * Usage: router.delete('/admin/users', requireAuth, requireSuperAdmin, handler)
 */
function requireSuperAdmin(req, res, next) {
  return requirePermission('all', 'edit')(req, res, next);
}

/**
 * Middleware: Require specific office bearer role
 * Usage: router.get('/finance', requireAuth, requireRole('Treasurer', 'Joint Treasurer'), handler)
 * 
 * @param {...string} allowedRoles - One or more role names to allow
 * @returns {Function} Express middleware function
 */
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        logger.warn(`[requireRole] Unauthenticated access attempt`);
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!allowedRoles.includes(req.effectiveRole)) {
        logger.warn(
          `[requireRole] DENIED: User ${req.user.id} has role ${req.effectiveRole}, ` +
          `required: ${allowedRoles.join(' or ')}`
        );

        return res.status(403).json({
          success: false,
          error: `This action requires role: ${allowedRoles.join(' or ')}`
        });
      }

      next();
    } catch (error) {
      logger.error('[requireRole] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Role check failed'
      });
    }
  };
}

/**
 * Middleware: Check if user can manage office bearers
 * Only President/Vice President allowed
 */
function requireManageOfficeBearer(req, res, next) {
  return requirePermission('office-bearers', 'edit')(req, res, next);
}

module.exports = {
  attachEffectiveRole,
  requirePermission,
  requireSuperAdmin,
  requireRole,
  requireManageOfficeBearer
};
