import { Router } from 'express';
import * as controller from '../controllers/document-definition.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.get('/', requireAuth, asyncHandler(controller.list));
export default router;
