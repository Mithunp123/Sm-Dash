import express from 'express';
import { authenticateToken, allowFinance } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';
import { BillFolder } from '../models/BillFolder.js';
import { Expense } from '../models/Expense.js';

const router = express.Router();

// ============================================
// EXPENSES ENDPOINTS
// ============================================

/**
 * POST /expenses/add
 * Add a new expense to a folder
 * CRITICAL: Must include event_id, folder_id, and all calculations
 */
router.post('/add', authenticateToken, allowFinance, async (req, res) => {
  try {
    const {
      event_id,
      folder_id,
      expense_title,
      category,
      transport_from,
      transport_to,
      transport_mode,
      fuel_amount,
      breakfast_amount,
      lunch_amount,
      dinner_amount,
      refreshment_amount,
      accommodation_amount,
      other_expense
    } = req.body;

    // Validate required fields
    if (!event_id || !folder_id || !expense_title) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: event_id, folder_id, expense_title'
      });
    }

    // Validate numbers
    const amountFields = {
      fuel_amount: parseFloat(fuel_amount) || 0,
      breakfast_amount: parseFloat(breakfast_amount) || 0,
      lunch_amount: parseFloat(lunch_amount) || 0,
      dinner_amount: parseFloat(dinner_amount) || 0,
      refreshment_amount: parseFloat(refreshment_amount) || 0,
      accommodation_amount: parseFloat(accommodation_amount) || 0,
      other_expense: parseFloat(other_expense) || 0
    };

    // Check for negative values
    for (const [key, value] of Object.entries(amountFields)) {
      if (value < 0) {
        return res.status(400).json({
          success: false,
          message: `${key} cannot be negative`
        });
      }
    }

    const expense = await Expense.addExpense({
      event_id: parseInt(event_id),
      folder_id: parseInt(folder_id),
      expense_title: String(expense_title).trim(),
      category: category || 'other',
      transport_from: transport_from || null,
      transport_to: transport_to || null,
      transport_mode: transport_mode || null,
      ...amountFields,
      created_by: req.user.id
    });

    // Log activity
    await logActivity(req.user.id, 'CREATE_EXPENSE', { event_id, folder_id, expense_title }, req, {
      action_type: 'CREATE',
      module_name: 'expenses',
      action_description: `Created expense: ${expense_title}`,
      reference_id: expense.id
    });

    res.status(201).json({
      success: true,
      message: 'Expense added successfully',
      expense
    });
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add expense',
      error: error.message
    });
  }
});

/**
 * GET /expenses/folder/:folderId
 * Get all expenses in a folder
 */
router.get('/folder/:folderId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { folderId } = req.params;

    if (!folderId) {
      return res.status(400).json({
        success: false,
        message: 'folderId is required'
      });
    }

    const expenses = await Expense.getExpensesByFolder(parseInt(folderId));
    const summary = await Expense.getFolderSummary(parseInt(folderId));

    res.json({
      success: true,
      expenses,
      summary,
      count: expenses.length
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses',
      error: error.message
    });
  }
});

/**
 * GET /expenses/event/:eventId
 * Get all expenses for an event (across all folders)
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

    const expenses = await Expense.getExpensesByEvent(parseInt(eventId));
    const total = await Expense.getTotalExpenses(parseInt(eventId));

    res.json({
      success: true,
      expenses,
      total,
      count: expenses.length
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses',
      error: error.message
    });
  }
});

/**
 * GET /expenses/:expenseId
 * Get expense details
 */
router.get('/:expenseId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { expenseId } = req.params;

    if (!expenseId) {
      return res.status(400).json({
        success: false,
        message: 'expenseId is required'
      });
    }

    const expense = await Expense.getExpenseById(parseInt(expenseId));

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      expense
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense',
      error: error.message
    });
  }
});

/**
 * PUT /expenses/:expenseId
 * Update expense
 */
router.put('/:expenseId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const {
      expense_title,
      category,
      transport_from,
      transport_to,
      transport_mode,
      fuel_amount,
      breakfast_amount,
      lunch_amount,
      dinner_amount,
      refreshment_amount,
      accommodation_amount,
      other_expense
    } = req.body;

    if (!expenseId) {
      return res.status(400).json({
        success: false,
        message: 'expenseId is required'
      });
    }

    if (!expense_title) {
      return res.status(400).json({
        success: false,
        message: 'expense_title is required'
      });
    }

    const result = await Expense.updateExpense(parseInt(expenseId), {
      expense_title: String(expense_title).trim(),
      category: category || 'other',
      transport_from: transport_from || null,
      transport_to: transport_to || null,
      transport_mode: transport_mode || null,
      fuel_amount: parseFloat(fuel_amount) || 0,
      breakfast_amount: parseFloat(breakfast_amount) || 0,
      lunch_amount: parseFloat(lunch_amount) || 0,
      dinner_amount: parseFloat(dinner_amount) || 0,
      refreshment_amount: parseFloat(refreshment_amount) || 0,
      accommodation_amount: parseFloat(accommodation_amount) || 0,
      other_expense: parseFloat(other_expense) || 0
    });

    if (result.success) {
      await logActivity(req.user.id, 'UPDATE_EXPENSE', { expenseId }, req, {
        action_type: 'UPDATE',
        module_name: 'expenses',
        action_description: `Updated expense: ${expense_title}`,
        reference_id: expenseId
      });
    }

    res.json({
      success: result.success,
      message: result.success ? 'Expense updated successfully' : 'Expense not found'
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense',
      error: error.message
    });
  }
});

/**
 * DELETE /expenses/:expenseId
 * Delete expense
 */
router.delete('/:expenseId', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { expenseId } = req.params;

    if (!expenseId) {
      return res.status(400).json({
        success: false,
        message: 'expenseId is required'
      });
    }

    const result = await Expense.deleteExpense(parseInt(expenseId));

    if (result.success) {
      await logActivity(req.user.id, 'DELETE_EXPENSE', { expenseId }, req, {
        action_type: 'DELETE',
        module_name: 'expenses',
        action_description: 'Deleted expense',
        reference_id: expenseId
      });
    }

    res.json({
      success: result.success,
      message: result.success ? 'Expense deleted successfully' : 'Expense not found'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense',
      error: error.message
    });
  }
});

/**
 * GET /expenses/summary/event/:eventId
 * Get financial summary for an event
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

    const total = await Expense.getTotalExpenses(parseInt(eventId));

    res.json({
      success: true,
      summary: {
        total_expenses: total
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

// Re-export bills folder endpoints
router.post('/folder/add', authenticateToken, allowFinance, async (req, res) => {
  try {
    const { event_id, folder_name, description } = req.body;

    if (!event_id || !folder_name) {
      return res.status(400).json({
        success: false,
        message: 'event_id and folder_name are required'
      });
    }

    const folder = await BillFolder.createFolder({
      event_id: parseInt(event_id),
      folder_name: String(folder_name).trim(),
      description: description || '',
      created_by: req.user.id
    });

    await logActivity(req.user.id, 'CREATE_FOLDER', { event_id, folder_name }, req, {
      action_type: 'CREATE',
      module_name: 'bills',
      action_description: `Created bill folder: ${folder_name}`,
      reference_id: folder.id
    });

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      id: folder.id
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

export default router;
