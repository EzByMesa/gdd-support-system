import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listArticles, getArticle, createArticle, updateArticle,
  deleteArticle, searchSimilar, convertFromTicket
} from '../controllers/knowledgeController.js';

const router = Router();

// Public (для авторизованных)
router.get('/', authenticate, asyncHandler(listArticles));
router.get('/:id', authenticate, asyncHandler(getArticle));
router.post('/search', authenticate, asyncHandler(searchSimilar));

// Staff only
router.post('/', authenticate, authorize('AGENT', 'SENIOR_AGENT', 'ADMIN'), asyncHandler(createArticle));
router.put('/:id', authenticate, authorize('AGENT', 'SENIOR_AGENT', 'ADMIN'), asyncHandler(updateArticle));
router.delete('/:id', authenticate, authorize('AGENT', 'SENIOR_AGENT', 'ADMIN'), asyncHandler(deleteArticle));
router.post('/from-ticket/:ticketId', authenticate, authorize('AGENT', 'SENIOR_AGENT', 'ADMIN'), asyncHandler(convertFromTicket));

export default router;
