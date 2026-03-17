// DEPRECATED: legacy billing module
// This module only forwards requests to the new `/api/finance` router.
import express from 'express';
import financeRoutes from './finance.js';

const router = express.Router();

// forward everything to finance
router.use('/', (req, res, next) => {
  console.warn(`Deprecation warning: /api/bills${req.path} is now handled by /api/finance${req.path}`);
  next();
}, financeRoutes);

export default router;

