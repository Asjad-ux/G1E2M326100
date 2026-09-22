import { Router } from 'express';
import * as c from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
const router=Router(); router.use(requireAuth);
router.get('/',asyncHandler(c.list)); router.patch('/:id/read',asyncHandler(c.read)); router.post('/read-all',asyncHandler(c.readAll));
export default router;
