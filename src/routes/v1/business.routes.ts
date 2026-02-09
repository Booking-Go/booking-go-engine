import { Router } from 'express';

import { authenticate, authorize } from '../../middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /businesses - Get all businesses (with filters)
router.get('/', (req, res) => {
  // TODO: Implement get all businesses
  res.status(501).json({ message: 'Get all businesses - To be implemented' });
});

// GET /businesses/:id - Get business by ID
router.get('/:id', (req, res) => {
  // TODO: Implement get business by ID
  res.status(501).json({ message: 'Get business by ID - To be implemented' });
});

// POST /businesses - Create new business (business_owner only)
router.post('/', authorize('business_owner', 'admin'), (req, res) => {
  // TODO: Implement create business
  res.status(501).json({ message: 'Create business - To be implemented' });
});

// PUT /businesses/:id - Update business (business_owner only)
router.put('/:id', authorize('business_owner', 'admin'), (req, res) => {
  // TODO: Implement update business
  res.status(501).json({ message: 'Update business - To be implemented' });
});

// DELETE /businesses/:id - Delete business (business_owner only)
router.delete('/:id', authorize('business_owner', 'admin'), (req, res) => {
  // TODO: Implement delete business
  res.status(501).json({ message: 'Delete business - To be implemented' });
});

// GET /businesses/:id/services - Get business services
router.get('/:id/services', (req, res) => {
  // TODO: Implement get business services
  res.status(501).json({ message: 'Get business services - To be implemented' });
});

// POST /businesses/:id/services - Create service for business
router.post('/:id/services', authorize('business_owner', 'admin'), (req, res) => {
  // TODO: Implement create service
  res.status(501).json({ message: 'Create service - To be implemented' });
});

// GET /businesses/:id/analytics - Get business analytics
router.get('/:id/analytics', authorize('business_owner', 'admin'), (req, res) => {
  // TODO: Implement get business analytics
  res.status(501).json({ message: 'Get business analytics - To be implemented' });
});

export default router;
