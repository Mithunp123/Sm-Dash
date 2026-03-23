/**
 * Validation Middleware for Fundraising & Expenses
 */

const validateFundCollection = (req, res, next) => {
  const { event_id, payer_name, amount, payment_mode } = req.body;

  // Required fields
  if (!event_id || !payer_name || !amount || !payment_mode) {
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

  // Validate payment mode
  if (!['cash', 'online'].includes(payment_mode)) {
    return res.status(400).json({
      success: false,
      message: 'payment_mode must be either "cash" or "online"'
    });
  }

  // Validate contributor type if provided
  if (req.body.contributor_type && !['staff', 'student', 'other'].includes(req.body.contributor_type)) {
    return res.status(400).json({
      success: false,
      message: 'contributor_type must be one of: staff, student, other'
    });
  }

  next();
};

const validateExpense = (req, res, next) => {
  const { event_id, folder_id, expense_title, category } = req.body;

  // Required fields
  if (!event_id || !folder_id || !expense_title) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: event_id, folder_id, expense_title'
    });
  }

  // Validate category
  const validCategories = ['fuel', 'food', 'travel', 'accommodation', 'other'];
  if (category && !validCategories.includes(category)) {
    return res.status(400).json({
      success: false,
      message: `category must be one of: ${validCategories.join(', ')}`
    });
  }

  // Validate amounts are positive numbers
  const amountFields = [
    'fuel_amount', 'breakfast_amount', 'lunch_amount', 'dinner_amount',
    'refreshment_amount', 'accommodation_amount', 'other_expense'
  ];

  for (const field of amountFields) {
    if (req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '') {
      const value = parseFloat(req.body[field]);
      if (isNaN(value) || value < 0) {
        return res.status(400).json({
          success: false,
          message: `${field} must not be negative`
        });
      }
    }
  }

  next();
};

const validateBillFolder = (req, res, next) => {
  const { event_id, folder_name } = req.body;

  if (!event_id || !folder_name) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: event_id, folder_name'
    });
  }

  if (folder_name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'folder_name must be at least 2 characters'
    });
  }

  next();
};

module.exports = {
  validateFundCollection,
  validateExpense,
  validateBillFolder
};
