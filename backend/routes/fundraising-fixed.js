import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, allowFinance } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';
import { FundCollection } from '../models/FundCollection.js';

const router = express.Router();

// ============================================
// FUND RAISING ENDPOINTS
// ============================================

/**
 * POST /fundraising/add
 * Add a new fund collection entry
 */
router.post('/add', authenticateToken, allowFinance, async (req, res) => {
  try {
    const {
      event_id,
      payer_name,
      department,
      amount,
      payment_mode
    } = req.body;

    // Validate required fields
    if (!event_id || !payer_name || amount === undefined || amount === null || !payment_mode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: event_id, payer_name, amount, payment_mode'
      });
    }

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'amount must be a positive number'
      });
    }

    // Validate payment_mode
    if (!['cash', 'upi'].includes(payment_mode)) {
      return res.status(400).json({
        success: false,
        message: 'payment_mode must be either "cash" or "upi"'
      });
    }

    // Auto-fill received_by with logged-in user
    const collection = await FundCollection.addCollection({
      event_id: parseInt(event_id),
      payer_name: String(payer_name).trim(),
      department: department || null,
      amount: parsedAmount,
      payment_mode: String(payment_mode).toLowerCase(),
      received_by: req.user.id  // CRITICAL: Auto-populate from logged-in user
    });

    // Log activity
    await logActivity(req.user.id, 'CREATE_FUND_ENTRY', { event_id, payer_name, amount }, req, {
      action_type: 'CREATE',
      module_name: 'fundraising',
      action_description: `Added fund entry: ${payer_name} - ₹${parsedAmount}`,
      reference_id: collection.id
    });

    res.status(201).json({
      success: true,
      message: 'Fund entry added successfully',
      collection
    });
  } catch (error) {
    console.error('Error adding fund entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add fund entry',
      error: error.message
    });
  }
});

/**
 * GET /fundraising/event/:eventId
 * Get all fund collections for an event
 */
router.get('/event/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'eventId is required'
      });
    }

    const collections = await FundCollection.getCollectionsByEvent(parseInt(eventId));
    const total = await FundCollection.getTotalCollections(parseInt(eventId));

    res.json({
      success: true,
      collections,
      total_raised: total,
      count: collections.length
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collections',
      error: error.message
    });
  }
});

/**
 * GET /fundraising/:collectionId
 * Get specific fund collection entry
 */
router.get('/:collectionId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { collectionId } = req.params;

    if (!collectionId) {
      return res.status(400).json({
        success: false,
        message: 'collectionId is required'
      });
    }

    const collection = await FundCollection.getCollectionById(parseInt(collectionId));

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Fund collection not found'
      });
    }

    res.json({
      success: true,
      collection
    });
  } catch (error) {
    console.error('Error fetching collection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collection',
      error: error.message
    });
  }
});

/**
 * PUT /fundraising/:collectionId
 * Update fund collection entry
 */
router.put('/:collectionId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { payer_name, department, amount, payment_mode } = req.body;

    if (!collectionId) {
      return res.status(400).json({
        success: false,
        message: 'collectionId is required'
      });
    }

    if (!payer_name || amount === undefined || !payment_mode) {
      return res.status(400).json({
        success: false,
        message: 'payer_name, amount, and payment_mode are required'
      });
    }

    const result = await FundCollection.updateCollection(parseInt(collectionId), {
      payer_name: String(payer_name).trim(),
      department: department || null,
      amount: parseFloat(amount),
      payment_mode: String(payment_mode).toLowerCase()
    });

    if (result.success) {
      await logActivity(req.user.id, 'UPDATE_FUND_ENTRY', { collectionId }, req, {
        action_type: 'UPDATE',
        module_name: 'fundraising',
        action_description: `Updated fund entry: ${payer_name}`,
        reference_id: collectionId
      });
    }

    res.json({
      success: result.success,
      message: result.success ? 'Collection updated successfully' : 'Collection not found'
    });
  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update collection',
      error: error.message
    });
  }
});

/**
 * DELETE /fundraising/:collectionId
 * Delete fund collection entry
 */
router.delete('/:collectionId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { collectionId } = req.params;

    if (!collectionId) {
      return res.status(400).json({
        success: false,
        message: 'collectionId is required'
      });
    }

    const result = await FundCollection.deleteCollection(parseInt(collectionId));

    if (result.success) {
      await logActivity(req.user.id, 'DELETE_FUND_ENTRY', { collectionId }, req, {
        action_type: 'DELETE',
        module_name: 'fundraising',
        action_description: 'Deleted fund entry',
        reference_id: collectionId
      });
    }

    res.json({
      success: result.success,
      message: result.success ? 'Collection deleted successfully' : 'Collection not found'
    });
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete collection',
      error: error.message
    });
  }
});

/**
 * GET /fundraising/summary/:eventId
 * Get fundraising summary for an event
 */
router.get('/summary/event/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'eventId is required'
      });
    }

    const collections = await FundCollection.getCollectionsByEvent(parseInt(eventId));
    const total = await FundCollection.getTotalCollections(parseInt(eventId));

    // Group by payment mode
    const byCashMode = collections.reduce((sum, c) => sum + (c.payment_mode === 'cash' ? c.amount : 0), 0);
    const byUpiMode = collections.reduce((sum, c) => sum + (c.payment_mode === 'upi' ? c.amount : 0), 0);

    res.json({
      success: true,
      summary: {
        total_raised: total,
        entries_count: collections.length,
        cash_received: byCashMode,
        upi_received: byUpiMode,
        by_payment_mode: {
          cash: byCashMode,
          upi: byUpiMode
        }
      }
    });
  } catch (error) {
    console.error('Error calculating summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate summary',
      error: error.message
    });
  }
});

/**
 * GET /fundraising/filter/:eventId
 * Get filtered fund collections
 */
router.get('/filter/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { payment_mode, start_date, end_date, received_by } = req.query;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'eventId is required'
      });
    }

    const filters = {};
    if (payment_mode) filters.payment_mode = String(payment_mode).toLowerCase();
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    if (received_by) filters.received_by = parseInt(received_by);

    const collections = await FundCollection.getCollectionsByEvent(parseInt(eventId), filters);

    res.json({
      success: true,
      collections,
      count: collections.length
    });
  } catch (error) {
    console.error('Error fetching filtered collections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collections',
      error: error.message
    });
  }
});

/**
 * GET /fundraising/receivedby/list/:eventId
 * Get collections received by a specific user
 */
router.get('/receivedby/:eventId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'eventId is required'
      });
    }

    // Get collections received by the logged-in user
    const collections = await FundCollection.getCollectionsByReceivedBy(req.user.id, parseInt(eventId));
    const total = collections.reduce((sum, c) => sum + (c.amount || 0), 0);

    res.json({
      success: true,
      collections,
      my_total: total,
      count: collections.length
    });
  } catch (error) {
    console.error('Error fetching user collections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collections',
      error: error.message
    });
  }
});

export default router;
