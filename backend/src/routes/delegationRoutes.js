import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createDelegation, respondDelegation,
  listIncoming, listOutgoing, countIncoming
} from '../controllers/delegationController.js';

const router = Router();

router.get('/incoming', authenticate, authorize('AGENT', 'ADMIN'), listIncoming);
router.get('/incoming/count', authenticate, authorize('AGENT', 'ADMIN'), countIncoming);
router.get('/outgoing', authenticate, authorize('AGENT', 'ADMIN'), listOutgoing);
router.put('/:id/respond', authenticate, authorize('AGENT', 'ADMIN'), respondDelegation);

export default router;

// Делегирование из тикета — подключается отдельно в ticketRoutes
export { createDelegation };
