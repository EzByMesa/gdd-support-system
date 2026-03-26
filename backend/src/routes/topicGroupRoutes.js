import { Router } from 'express';
import { authenticate, authorize, requireAdmin } from '../middleware/auth.js';
import {
  listTopicGroups, getTopicGroup, updateTopicGroup,
  deleteTopicGroup, mergeTopicGroups, reclassifyAllTickets
} from '../controllers/topicGroupController.js';

const router = Router();

router.get('/', authenticate, authorize('AGENT', 'SENIOR_AGENT', 'ADMIN'), listTopicGroups);
router.get('/:id', authenticate, authorize('AGENT', 'SENIOR_AGENT', 'ADMIN'), getTopicGroup);
router.put('/:id', authenticate, requireAdmin, updateTopicGroup);
router.delete('/:id', authenticate, requireAdmin, deleteTopicGroup);
router.post('/:id/merge/:otherId', authenticate, requireAdmin, mergeTopicGroups);
router.post('/reclassify', authenticate, requireAdmin, reclassifyAllTickets);

export default router;
