import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, allowFinance, requireAdmin } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';
import { BillFolder } from '../models/BillFolder.js';
import { Expense } from '../models/Expense.js';

const router = express.Router();

// ============================================
// BILL FOLDERS ENDPOINTS
// ============================================

/**
 * POST /bills/folders/add
 * Create a new bill folder for an event
 */
router.post('/folders/add', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { event_id, folder_name, description } = req.body;

    // Validate required fields
    if (!event_id || !folder_name) {
      return res.status(400).json({
        success: false,
        message: 'event_id and folder_name are required'
      });
    }

    const folderNameStr = String(folder_name).trim();
    if (folderNameStr.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'folder_name must be at least 2 characters'
      });
    }

    const folder = await BillFolder.createFolder({
      event_id: parseInt(event_id),
      folder_name: folderNameStr,
      description: description || '',
      created_by: req.user.id
    });

    // Log activity
    await logActivity(req.user.id, 'CREATE_FOLDER', { event_id, folder_name }, req, {
      action_type: 'CREATE',
      module_name: 'bills',
      action_description: `Created bill folder: ${folderNameStr}`,
      reference_id: folder.id
    });

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      folder
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create folder',
      error: error.message
    });
  }
});

/**
 * GET /bills/folders/:eventId
 * Get all folders for an event
 */
router.get('/folders/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'eventId is required'
      });
    }

    const folders = await BillFolder.getFoldersByEvent(parseInt(eventId));

    res.json({
      success: true,
      folders,
      count: folders.length
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch folders',
      error: error.message
    });
  }
});

/**
 * GET /bills/folders/details/:folderId
 * Get folder details with expenses summary
 */
router.get('/folders/details/:folderId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { folderId } = req.params;

    if (!folderId) {
      return res.status(400).json({
        success: false,
        message: 'folderId is required'
      });
    }

    const folder = await BillFolder.getFolderById(parseInt(folderId));
    const summary = await BillFolder.getFolderSummary(parseInt(folderId));

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    res.json({
      success: true,
      folder: { ...folder, ...summary }
    });
  } catch (error) {
    console.error('Error fetching folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch folder',
      error: error.message
    });
  }
});

/**
 * PUT /bills/folders/:folderId
 * Update folder details
 */
router.put('/folders/:folderId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { folderId } = req.params;
    const { folder_name, description } = req.body;

    if (!folderId) {
      return res.status(400).json({
        success: false,
        message: 'folderId is required'
      });
    }

    if (!folder_name) {
      return res.status(400).json({
        success: false,
        message: 'folder_name is required'
      });
    }

    const result = await BillFolder.updateFolder(parseInt(folderId), {
      folder_name: String(folder_name).trim(),
      description: description || ''
    });

    if (result.success) {
      await logActivity(req.user.id, 'UPDATE_FOLDER', { folderId }, req, {
        action_type: 'UPDATE',
        module_name: 'bills',
        action_description: `Updated bill folder: ${folder_name}`,
        reference_id: folderId
      });
    }

    res.json({
      success: result.success,
      message: result.success ? 'Folder updated successfully' : 'Folder not found'
    });
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update folder',
      error: error.message
    });
  }
});

/**
 * DELETE /bills/folders/:folderId
 * Delete folder (cascades to expenses)
 */
router.delete('/folders/:folderId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { folderId } = req.params;

    if (!folderId) {
      return res.status(400).json({
        success: false,
        message: 'folderId is required'
      });
    }

    const result = await BillFolder.deleteFolder(parseInt(folderId));

    if (result.success) {
      await logActivity(req.user.id, 'DELETE_FOLDER', { folderId }, req, {
        action_type: 'DELETE',
        module_name: 'bills',
        action_description: 'Deleted bill folder',
        reference_id: folderId
      });
    }

    res.json({
      success: result.success,
      message: result.success ? 'Folder deleted successfully' : 'Folder not found'
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete folder',
      error: error.message
    });
  }
});

export default router;
