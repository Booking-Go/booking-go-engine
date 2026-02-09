import { Router } from 'express';

import v1Router from './v1';

const router = Router();

// Mount versioned API routes
router.use('/api/v1', v1Router);

// Future: router.use('/api/v2', v2Router);

export default router;
